import { db } from "@/lib/db";
import { ensureStravaAccessToken, listAthleteActivities } from "@/lib/strava";

type SyncResult = {
  fetched: number;
  created: number;
  updated: number;
  pages: number;
};

export async function upsertActivity(userId: string, a: any) {
  const id = String(a.id);
  const data = {
    id,
    userId,
    name: a.name ?? null,
    type: a.type ?? null,
    distance_m: a.distance ?? null,
    moving_s: a.moving_time ?? null,
    elapsed_s: a.elapsed_time ?? null,
    start_date: a.start_date ? new Date(a.start_date) : null,
    timezone: a.timezone ?? null,
    is_trainer: a.trainer ?? null,
    is_commute: a.commute ?? null,
    total_elev_m: a.total_elevation_gain ?? null,
    raw: a as any,
  };

  try {
    await db.activity.create({ data });
    return "created";
  } catch (e: any) {
    if (
      String(e.code) === "P2002" ||
      String(e.message).includes("Unique constraint")
    ) {
      await db.activity.update({ where: { id }, data });
      return "updated";
    }
    throw e;
  }
}

export async function backfillAllActivities(
  userId: string
): Promise<SyncResult> {
  const accessToken = await ensureStravaAccessToken(userId);
  let page = 1,
    perPage = 100;
  let fetched = 0,
    created = 0,
    updated = 0,
    pages = 0;

  await db.syncState.upsert({
    where: { userId },
    update: { lastSyncStart: new Date() },
    create: { userId, lastSyncStart: new Date(), backfillDone: false },
  });

  while (true) {
    const batch = await listAthleteActivities(accessToken, page, perPage);
    if (!batch.length) break;

    for (const a of batch) {
      const r = await upsertActivity(userId, a);
      r === "created" ? created++ : updated++;
      fetched++;
    }
    pages++;
    page++;

    // Be nice to the API and your server
    await new Promise((res) => setTimeout(res, 350));
  }

  // Compute newest start_date we have
  const newest = await db.activity.findFirst({
    where: { userId },
    orderBy: { start_date: "desc" },
    select: { start_date: true },
  });

  await db.syncState.update({
    where: { userId },
    data: { lastSyncedAt: newest?.start_date ?? null, backfillDone: true },
  });

  return { fetched, created, updated, pages };
}

export async function syncSinceLast(userId: string): Promise<SyncResult> {
  // Pull first a few pages and stop when we reach an activity older than lastSyncedAt
  const accessToken = await ensureStravaAccessToken(userId);
  const state = await db.syncState.findUnique({ where: { userId } });
  const since = state?.lastSyncedAt;

  let page = 1,
    perPage = 100;
  let fetched = 0,
    created = 0,
    updated = 0,
    pages = 0;
  let newest: Date | null = since ?? null;
  await db.syncState.upsert({
    where: { userId },
    update: { lastSyncStart: new Date() },
    create: { userId, lastSyncStart: new Date(), backfillDone: false },
  });

  outer: while (page <= 5) {
    // cap pages for safety; increase if needed
    const batch = await listAthleteActivities(accessToken, page, perPage);
    if (!batch.length) break;
    for (const a of batch) {
      const start = a.start_date ? new Date(a.start_date) : null;
      if (since && start && start <= since) {
        // We’ve reached activities we’ve already synced
        break outer;
      }
      const r = await upsertActivity(userId, a);
      r === "created" ? created++ : updated++;
      fetched++;
      if (start && (!newest || start > newest)) newest = start;
    }
    pages++;
    page++;
    await new Promise((res) => setTimeout(res, 350));
  }

  if (newest) {
    await db.syncState.update({
      where: { userId },
      data: { lastSyncedAt: newest },
    });
  }
  return { fetched, created, updated, pages };
}
