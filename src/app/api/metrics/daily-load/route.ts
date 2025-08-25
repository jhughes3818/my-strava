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

  const rows = await db.$queryRaw<Array<{ day: Date; secs: number }>>`
    SELECT
      date_trunc('day', "start_date")::date AS day,
      COALESCE(SUM("moving_s"),0)::float AS secs
    FROM "Activity"
    WHERE "userId" = ${userId}
    GROUP BY 1
    ORDER BY day ASC;
  `;

  // convert to hours as proxy for TSS
  const daily = rows.map((r) => ({ day: r.day, load: r.secs / 3600 }));

  // calc fitness/fatigue/freshness
  const tauATL = 7;
  const tauCTL = 42;
  const kATL = 1 - Math.exp(-1 / tauATL);
  const kCTL = 1 - Math.exp(-1 / tauCTL);
  let atl = 0,
    ctl = 0;

  const data = daily.map((d) => {
    atl = atl + kATL * (d.load - atl);
    ctl = ctl + kCTL * (d.load - ctl);
    const tsb = ctl - atl;
    return {
      ...d,
      fitness: +ctl.toFixed(2),
      fatigue: +atl.toFixed(2),
      freshness: +tsb.toFixed(2),
    };
  });

  const latest = data.length > 0 ? data[data.length - 1] : null;

  return json({ ok: true, data, latest });
}
