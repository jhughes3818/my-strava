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
  if (!userId) return json({ ok: false, error: "No user id" }, { status: 401 });

  const url = new URL(req.url);
  const weeksParam = url.searchParams.get("weeks");
  const weeks = Math.max(1, Math.min(52, Number(weeksParam) || 12));

  // distance_m is meters; moving_s is seconds
  // ISO week start is Monday in Postgres with date_trunc('week', ...)
  const rows = await db.$queryRaw<
    Array<{ wk: Date; distance_m: number; moving_s: number }>
  >`
    SELECT
      date_trunc('week', "start_date") AS wk,
      COALESCE(SUM("distance_m"), 0)::float AS distance_m,
      COALESCE(SUM("moving_s"), 0)::float AS moving_s
    FROM "Activity"
    WHERE "userId" = ${userId}
      AND "start_date" IS NOT NULL
    GROUP BY 1
    ORDER BY wk DESC
    LIMIT ${weeks};
  `;

  // Map to client‑friendly shape; also compute km and hours
  const data = rows
    .map((r) => ({
      weekStart: r.wk, // Date
      km: +(r.distance_m / 1000).toFixed(2),
      hours: +(r.moving_s / 3600).toFixed(2),
    }))
    .reverse(); // oldest → newest for charts

  return json({ ok: true, data });
}
