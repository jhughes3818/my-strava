import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { json } from "@/lib/http";
import { db } from "@/lib/db";
import {
  ensureStravaAccessToken,
  getActivityDetail,
  getActivityStreams,
} from "@/lib/strava";

import { Prisma } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string | undefined;
  if (!userId) return json({ ok: false, error: "No user id" }, { status: 401 });

  const accessToken = await ensureStravaAccessToken(userId);

  // pick up to N activities missing detail or streams
  const BATCH = 15;
  const targets = await db.activity.findMany({
    where: {
      userId,
      OR: [
        { raw_detail: { equals: Prisma.DbNull } }, // ✅ SQL NULL
        { has_streams: { equals: false } }, // or just { has_streams: false }
      ],
    },
    orderBy: { start_date: "desc" },
    take: BATCH,
    select: { id: true },
  });

  if (targets.length === 0) {
    return json({ ok: true, message: "Nothing to update" });
  }

  let detailed = 0,
    streamed = 0;

  for (const { id } of targets) {
    // 1) Detail
    try {
      const d = await getActivityDetail(id, accessToken);

      await db.activity.update({
        where: { id },
        data: {
          raw_detail: d as any,
          avg_hr: d.average_heartrate ?? null,
          max_hr: d.max_heartrate ?? null,
          avg_speed: d.average_speed ?? null,
          avg_cadence: d.average_cadence ?? null,
          avg_watts: d.average_watts ?? null,
          calories: d.calories ?? null,
          device_name: d.device_name ?? null,
          map_polyline: d.map?.summary_polyline ?? null,
        },
      });
      detailed++;
    } catch (e) {
      // swallow single-activity errors to continue batch
      console.error("detail error", id, e);
    }

    // 2) Streams
    try {
      const s = await getActivityStreams(id, accessToken);
      if (!s) continue;

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
    } catch (e) {
      console.error("streams error", id, e);
    }
  }

  return json({ ok: true, batch: targets.length, detailed, streamed });
}
