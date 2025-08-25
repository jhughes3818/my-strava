import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  // Look back 14 days
  const rows = await db.$queryRaw<
    Array<{ day: Date; distance: number; secs: number }>
  >`
    SELECT
      date_trunc('day', "start_date")::date AS day,
      COALESCE(SUM("distance_m"),0)::float AS distance,
      COALESCE(SUM("moving_s"),0)::float AS secs
    FROM "Activity"
    WHERE "userId" = ${userId}
      AND "start_date" >= NOW() - interval '14 days'
    GROUP BY 1
    ORDER BY day ASC;
  `;

  // Bucket into 2 weeks
  const today = new Date();
  const last7 = new Date(today);
  last7.setDate(today.getDate() - 6); // inclusive
  const prev14 = new Date(today);
  prev14.setDate(today.getDate() - 13);

  let distNow = 0,
    timeNow = 0;
  let distPrev = 0,
    timePrev = 0;

  for (const r of rows) {
    const d = new Date(r.day);
    if (d >= last7) {
      distNow += r.distance;
      timeNow += r.secs;
    } else if (d >= prev14 && d < last7) {
      distPrev += r.distance;
      timePrev += r.secs;
    }
  }

  // convert to km + hours
  const kmNow = distNow / 1000;
  const kmPrev = distPrev / 1000;
  const hNow = timeNow / 3600;
  const hPrev = timePrev / 3600;

  // load proxy: hours (can be refined later)
  const loadNow = hNow;
  const loadPrev = hPrev;

  return json({
    ok: true,
    current: {
      km: +kmNow.toFixed(1),
      h: +hNow.toFixed(1),
      load: +loadNow.toFixed(1),
    },
    prev: {
      km: +kmPrev.toFixed(1),
      h: +hPrev.toFixed(1),
      load: +loadPrev.toFixed(1),
    },
  });
}
