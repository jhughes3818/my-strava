import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { json } from "@/lib/http";
import { db } from "@/lib/db";
import {
  ensureStravaAccessToken,
  listAthleteActivities,
  getStravaAccountForUser,
} from "@/lib/strava";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string | undefined;
  if (!userId)
    return json({ ok: false, error: "No user id on session" }, { status: 401 });

  // Ensure the user actually linked Strava
  const acct = await getStravaAccountForUser(userId);
  if (!acct)
    return json({ ok: false, error: "Strava not linked" }, { status: 400 });

  // Get a valid access token (refreshes if needed)
  const accessToken = await ensureStravaAccessToken(userId);

  // Fetch a page (keep it simple: first 50 for now)
  const activities = await listAthleteActivities(accessToken, 1, 50);

  // Upsert activities
  let created = 0,
    updated = 0;

  for (const a of activities) {
    const id = String(a.id);
    const payload = {
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

    // Try create; if exists, update
    try {
      await db.activity.create({ data: payload });
      created++;
    } catch (e: any) {
      // If it's a PK conflict, update existing
      if (
        String(e.message).includes("Unique constraint failed") ||
        String(e.code) === "P2002"
      ) {
        await db.activity.update({ where: { id }, data: { ...payload } });
        updated++;
      } else {
        throw e;
      }
    }
  }

  return json({ ok: true, fetched: activities.length, created, updated });
}
