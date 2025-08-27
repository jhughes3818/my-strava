import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { json } from "@/lib/http";
import { db } from "@/lib/db";
import {
  ensureStravaAccessToken,
  listAthleteActivities,
  getActivityDetail,
  getActivityStreams,
  getStravaAccountForUser,
} from "@/lib/strava";
import { upsertActivity } from "@/lib/strava-sync";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const acct = await getStravaAccountForUser(userId);
  if (!acct)
    return json({ ok: false, error: "Strava not linked" }, { status: 400 });

  const accessToken = await ensureStravaAccessToken(userId);

  // Fetch a reasonable number of recent activities
  const perPage = 100;
  const maxPages = 5;
  const summaries: Record<string, any> = {};

  for (let page = 1; page <= maxPages; page++) {
    const batch = await listAthleteActivities(accessToken, page, perPage);
    if (!batch.length) break;
    for (const a of batch) {
      summaries[String(a.id)] = a;
    }
    await new Promise((res) => setTimeout(res, 350));
  }

  const ids = Object.keys(summaries);
  if (ids.length === 0)
    return json({ ok: true, checked: 0, added: 0, streamed: 0 });

  const existing = await db.activity.findMany({
    where: { userId, id: { in: ids } },
    select: { id: true },
  });
  const existingSet = new Set(existing.map((a) => a.id));
  const missingIds = ids.filter((id) => !existingSet.has(id));

  let added = 0;
  let streamed = 0;

  for (const id of missingIds) {
    try {
      const detail = await getActivityDetail(id, accessToken);
      await upsertActivity(userId, detail);
      await db.activity.update({
        where: { id },
        data: {
          raw_detail: detail as any,
          avg_hr: detail.average_heartrate ?? null,
          max_hr: detail.max_heartrate ?? null,
          avg_speed: detail.average_speed ?? null,
          avg_cadence: detail.average_cadence ?? null,
          avg_watts: detail.average_watts ?? null,
          calories: detail.calories ?? null,
          device_name: detail.device_name ?? null,
          map_polyline: detail.map?.summary_polyline ?? null,
        },
      });
      added++;

      try {
        const s = await getActivityStreams(id, accessToken);
        if (s) {
          await db.activityStream.upsert({
            where: { activityId: id },
            create: {
              activityId: id,
              time: s.time?.data ?? null,
              heartrate: s.heartrate?.data ?? null,
              velocity_smooth: s.velocity_smooth?.data ?? null,
              altitude: s.altitude?.data ?? null,
              cadence: s.cadence?.data ?? null,
              watts: s.watts?.data ?? null,
              grade_smooth: s.grade_smooth?.data ?? null,
              latlng: s.latlng?.data ?? null,
            },
            update: {
              time: s.time?.data ?? null,
              heartrate: s.heartrate?.data ?? null,
              velocity_smooth: s.velocity_smooth?.data ?? null,
              altitude: s.altitude?.data ?? null,
              cadence: s.cadence?.data ?? null,
              watts: s.watts?.data ?? null,
              grade_smooth: s.grade_smooth?.data ?? null,
              latlng: s.latlng?.data ?? null,
            },
          });

          await db.activity.update({
            where: { id },
            data: { has_streams: true },
          });

          streamed++;
        }
      } catch (e) {
        console.error("stream error", id, e);
      }
    } catch (e) {
      console.error("refresh error", id, e);
    }
  }

  return json({
    ok: true,
    checked: ids.length,
    missing: missingIds.length,
    added,
    streamed,
  });
}
