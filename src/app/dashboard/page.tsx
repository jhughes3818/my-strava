// src/app/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import ConnectStravaButton from "@/components/ConnectStravaButton";
import SyncStravaButton from "@/components/SyncStravaButton";
import SignOutButton from "@/components/SignOutButton";
import SyncStravaDetailsButton from "@/components/SyncStravaDetailsButton";
import ActivityChart from "@/components/ActivityChart";
import WeeklyVolumeChart from "@/components/WeeklyVolumeChart";
import FitnessFreshnessChart from "@/components/FitnessFreshnessChart";
import TrainingStatus from "@/components/TrainingStatus";
import WeeklyStats from "@/components/WeeklyStats";
import { revalidatePath } from "next/cache";
import BackfillButton from "@/components/BackfillButton";
import TrainingCharts from "@/components/TrainingCharts";

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
    select: { id: true, name: true, type: true, start_date: true },
  });

  return (
    // inside your page component’s return:
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
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
              {/* client components */}

              {/* <SyncStravaButton />

              <SyncStravaDetailsButton /> */}

              {hasStrava && !syncState?.backfillDone ? (
                <div className="mt-3">
                  <BackfillButton />
                </div>
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
          <WeeklyStats />
        </section>
      )}

      {/* Pace & HR */}
      {/* Weekly volume */}
      {hasStrava && <TrainingCharts />}
    </div>
  );
}
