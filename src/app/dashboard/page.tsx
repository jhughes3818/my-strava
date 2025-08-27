// src/app/dashboard/page.tsx
import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import ConnectStravaButton from "@/components/ConnectStravaButton";
import SignOutButton from "@/components/SignOutButton";
import TrainingStatus from "@/components/TrainingStatus";
import WeeklyStats from "@/components/WeeklyStats";
import BackfillButton from "@/components/BackfillButton";
import RefreshButton from "@/components/RefreshButton";
import TrainingCharts from "@/components/TrainingCharts";
import Last7Days from "@/components/Last7Days";

function formatDuration(totalSeconds: number) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/api/auth/signin");

  // prefer id; fallback to email if available
  const where = (session.user as any).id
    ? { id: (session.user as any).id as string }
    : session.user.email
    ? { email: session.user.email }
    : undefined;

  if (!where) redirect("/api/auth/signin"); // no identifier we can use

  const user = await db.user.findFirst({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      accounts: { select: { provider: true } },
    },
  });

  async function autoSyncIfNeeded(userId: string) {
    // Fire-and-forget incremental sync; don’t block page
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/strava/incremental`, {
      method: "POST",
      // In dev, base URL may be empty -> relative works from client, not server.
      // For server in dev: fall back to relative via Next's internal fetch by omitting base.
      // Here we play safe with try/catch:
    }).catch(() => {});
  }

  const hasStrava = user?.accounts?.some((a) => a.provider === "strava");

  if (hasStrava) {
    await autoSyncIfNeeded(user!.id);
  }

  const syncState = await db.syncState.findUnique({
    where: { userId: user!.id },
  });

  const recent = await db.activity.findMany({
    where: { userId: user!.id, has_streams: true },
    orderBy: { start_date: "desc" },
    take: 10,
    select: {
      id: true,
      name: true,
      type: true,
      start_date: true,
      distance_m: true,
      moving_s: true,
    },
  });

  return (
    // inside your page component’s return:
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-black">Dashboard</h1>
        <SignOutButton />
      </div>

      <p className="mt-4 text-sm text-slate-600">
        {user?.name || user?.email
          ? `Welcome, ${user?.name ?? user?.email}!`
          : "Welcome!"}
      </p>

      <div className="mt-4">
        {hasStrava ? (
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-emerald-700 ring-1 ring-inset ring-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Strava connected
            </div>

            <div className="flex flex-wrap gap-3">
              <RefreshButton />
              {hasStrava && !syncState?.backfillDone ? (
                <BackfillButton />
              ) : (
                <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Activities Up To Date
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              Connect your Strava to start syncing activities.
            </p>
            <ConnectStravaButton />
          </div>
        )}
      </div>

      {hasStrava && (
        <section className="mt-8">
          <TrainingStatus />
        </section>
      )}

      {hasStrava && (
        <section className="mt-8">
          <Last7Days />
        </section>
      )}

      {hasStrava && (
        <section className="mt-8">
          <WeeklyStats />
        </section>
      )}

      {hasStrava && recent.length > 0 && (
        <section className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-black">
              Recent activities
            </h2>
            <Link
              href="/activities"
              className="text-sm text-sky-600 hover:underline"
            >
              All activities
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((a) => {
              const date = a.start_date
                ? new Date(a.start_date).toLocaleDateString()
                : "–";
              const type = a.type ?? "–";
              const distance =
                a.distance_m != null
                  ? `${(a.distance_m / 1000).toFixed(2)} km`
                  : "–";
              const time =
                a.moving_s != null ? formatDuration(a.moving_s) : "–";
              const load =
                a.moving_s != null
                  ? `${(a.moving_s / 3600).toFixed(1)} h`
                  : "–";

              return (
                <a
                  key={a.id}
                  href={`/activities/${a.id}`}
                  className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:bg-slate-50"
                >
                  <div className="truncate text-sm font-medium text-slate-900">
                    {a.name || a.type || "Activity"}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                    <div className="text-slate-500">Date</div>
                    <div className="text-right text-slate-900">{date}</div>
                    <div className="text-slate-500">Type</div>
                    <div className="text-right text-slate-900">{type}</div>
                    <div className="text-slate-500">Distance</div>
                    <div className="text-right text-slate-900">{distance}</div>
                    <div className="text-slate-500">Time</div>
                    <div className="text-right text-slate-900">{time}</div>
                    <div className="text-slate-500">Load</div>
                    <div className="text-right text-slate-900">{load}</div>
                  </div>
                </a>
              );
            })}
          </div>
        </section>
      )}

      {hasStrava && <TrainingCharts />}
    </div>
  );
}
