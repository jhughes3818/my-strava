import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect, notFound } from "next/navigation";
import ActivityChart from "@/components/ActivityChart";

export default async function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/api/auth/signin");

  const userId = (session.user as any).id as string | undefined;
  if (!userId) redirect("/api/auth/signin");

  const activity = await db.activity.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      name: true,
      type: true,
      start_date: true,
      distance_m: true,
      moving_s: true,
      avg_hr: true,
      avg_speed: true,
    },
  });

  if (!activity || activity.userId !== userId) notFound();

  const distance =
    activity.distance_m != null
      ? `${(activity.distance_m / 1000).toFixed(2)} km`
      : "–";

  const moving =
    activity.moving_s != null
      ? `${Math.floor(activity.moving_s / 60)}m ${activity.moving_s % 60}s`
      : "–";

  const avgHr =
    activity.avg_hr != null ? `${Math.round(activity.avg_hr)} bpm` : "–";

  const avgPace =
    activity.avg_speed && activity.avg_speed > 0
      ? (() => {
          const pace = 1000 / activity.avg_speed;
          const m = Math.floor(pace / 60);
          const s = Math.round(pace % 60);
          return `${m}:${String(s).padStart(2, "0")}/km`;
        })()
      : "–";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-black">
        {activity.name || activity.type || "Activity"}
      </h1>
      {activity.start_date && (
        <p className="mt-1 text-sm text-black">
          {new Date(activity.start_date).toLocaleString()}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-4 text-sm text-black">
        <div>
          <span>Distance</span>
          <div className="font-medium">{distance}</div>
        </div>
        <div>
          <span>Moving Time</span>
          <div className="font-medium">{moving}</div>
        </div>
        <div>
          <span>Avg HR</span>
          <div className="font-medium">{avgHr}</div>
        </div>
        <div>
          <span>Avg Pace</span>
          <div className="font-medium">{avgPace}</div>
        </div>
      </div>

      <div className="mt-8">
        <ActivityChart
          activities={[
            {
              id: activity.id,
              name: activity.name,
              type: activity.type,
              start_date: activity.start_date?.toISOString() ?? null,
            },
          ]}
        />
      </div>
    </div>
  );
}

