// src/app/dashboard/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import ConnectStravaButton from "@/components/ConnectStravaButton";
import SignOutButton from "@/components/SignOutButton";

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

  const hasStrava = user?.accounts?.some((a) => a.provider === "strava");

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <SignOutButton />
      </div>

      <div className="rounded-lg border p-4">
        <p className="mb-3">
          {user?.name || user?.email
            ? `Welcome, ${user?.name ?? user?.email}!`
            : "Welcome!"}
        </p>

        {hasStrava ? (
          <div className="text-green-700">
            ✅ Strava connected. You’re good to go.
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-600">
              Connect your Strava to start syncing activities.
            </p>
            <ConnectStravaButton />
          </div>
        )}
      </div>
    </div>
  );
}
