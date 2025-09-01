import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string | undefined;
  if (!userId)
    return json({ ok: false, error: "No user id" }, { status: 401 });

  const url = new URL(req.url);
  const daysParam = url.searchParams.get("days");
  const windowParam = url.searchParams.get("window");
  let days: number;
  if (daysParam === "max") {
    const earliest = await db.activity.findFirst({
      where: { userId },
      orderBy: { start_date: "asc" },
      select: { start_date: true },
    });
    if (earliest?.start_date) {
      const diff = Math.floor(
        (Date.now() - earliest.start_date.getTime()) / (1000 * 60 * 60 * 24)
      );
      days = Math.max(diff, 1);
    } else {
      days = 90;
    }
  } else {
    const parsed = Number(daysParam);
    days = Math.max(1, Math.min(730, isFinite(parsed) && parsed > 0 ? parsed : 90));
  }

  let windowSize = Number(windowParam);
  windowSize = windowSize === 30 ? 30 : 7; // default 7

  const lookback = days + windowSize - 1;

  const rows = await db.$queryRaw<
    Array<{ day: Date; km_avg: number; h_avg: number }>
  >`
    WITH days AS (
      SELECT generate_series(
        CURRENT_DATE - (${lookback} * INTERVAL '1 day'),
        CURRENT_DATE,
        INTERVAL '1 day'
      )::date AS day
    ),
    daily AS (
      SELECT
        date_trunc('day', "start_date")::date AS day,
        SUM("distance_m")::float / 1000 AS km,
        SUM("moving_s")::float / 3600 AS hours
      FROM "Activity"
      WHERE "userId" = ${userId}
        AND "start_date" >= CURRENT_DATE - (${lookback} * INTERVAL '1 day')
      GROUP BY 1
    ),
    merged AS (
      SELECT
        d.day,
        COALESCE(a.km, 0) AS km,
        COALESCE(a.hours, 0) AS hours
      FROM days d
      LEFT JOIN daily a USING (day)
    )
    SELECT
      day,
      AVG(km) OVER (ORDER BY day ROWS BETWEEN ${windowSize - 1} PRECEDING AND CURRENT ROW) AS km_avg,
      AVG(hours) OVER (ORDER BY day ROWS BETWEEN ${windowSize - 1} PRECEDING AND CURRENT ROW) AS h_avg
    FROM merged
    WHERE day >= CURRENT_DATE - (${days} * INTERVAL '1 day')
    ORDER BY day ASC;
  `;

  const data = rows.map((r) => ({
    day: r.day,
    km: +(+r.km_avg).toFixed(2),
    hours: +(+r.h_avg).toFixed(2),
  }));

  return json({ ok: true, data });
}
