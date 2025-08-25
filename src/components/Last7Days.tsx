import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// ---- helpers ----
function formatKm(m?: number | null) {
  if (!m || m <= 0) return "0.0 km";
  return `${(m / 1000).toFixed(1)} km`;
}
function formatHMM(seconds?: number | null) {
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${m}m`;
}
const TZ = "Australia/Perth"; // adjust if you later store per-user timezones

// Normalize a Date into a local (TZ) YYYY-MM-DD key
function dayKey(d: Date) {
  // display key in TZ
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
function dayLabel(d: Date) {
  const wd = new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    weekday: "short",
  }).format(d);
  const md = new Intl.DateTimeFormat("en-AU", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
  }).format(d);
  return { wd, md };
}

export default async function Last7Days() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  if (!userId) return null;

  // Build the last 7 day buckets (today to 6 days ago, in TZ)
  const today = new Date();
  const days: { date: Date; key: string }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push({ date: d, key: dayKey(d) });
  }
  const earliest = new Date(today);
  earliest.setDate(today.getDate() - 6);

  // Pull activities in the window; order newest first
  const activities = await db.activity.findMany({
    where: { userId, start_date: { gte: new Date(earliest) } },
    orderBy: { start_date: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      distance_m: true,
      moving_s: true,
      start_date: true,
    },
  });

  // Group by day key (in TZ)
  const byDay = new Map<string, typeof activities>();
  for (const a of activities) {
    const k = dayKey(a.start_date ?? new Date());
    const arr = byDay.get(k) ?? [];
    arr.push(a);
    byDay.set(k, arr);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-medium">Last 7 Days</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
        {days.map(({ date, key }) => {
          const { wd, md } = dayLabel(date);
          const list = byDay.get(key) ?? [];
          const totalDist = list.reduce((s, a) => s + (a.distance_m ?? 0), 0);
          const totalTime = list.reduce((s, a) => s + (a.moving_s ?? 0), 0);

          return (
            <div
              key={key}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-3"
            >
              {/* Day header */}
              <div className="mb-2 flex items-baseline justify-between">
                <div className="text-sm font-semibold text-slate-900">{wd}</div>
                <div className="text-xs text-slate-500">{md}</div>
              </div>

              {/* Totals */}
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-500">Total</span>
                <div className="text-right">
                  <div className="font-medium text-slate-900">
                    {formatKm(totalDist)}
                  </div>
                  <div className="text-xs text-slate-500">
                    {formatHMM(totalTime)}
                  </div>
                </div>
              </div>

              {/* Workouts list */}
              <div className="mt-1 space-y-2">
                {list.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-200 p-3 text-center text-xs text-slate-400">
                    No workout
                  </div>
                ) : (
                  list.slice(0, 3).map((w) => (
                    <div
                      key={w.id}
                      className="rounded-md border border-slate-200 p-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="truncate pr-2 text-sm font-medium text-slate-900">
                          {w.name || w.type || "Activity"}
                        </div>
                        <div className="text-xs text-slate-500">
                          {formatKm(w.distance_m)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        {formatHMM(w.moving_s)}
                      </div>
                    </div>
                  ))
                )}

                {list.length > 3 && (
                  <div className="text-xs text-slate-500">
                    +{list.length - 3} more…
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
