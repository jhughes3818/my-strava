import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/api/auth/signin");

  const userId = (session.user as any).id as string | undefined;
  if (!userId) redirect("/api/auth/signin");

  const activities = await db.activity.findMany({
    where: {
      userId,
      ...(q
        ? {
            name: {
              contains: q,
              mode: "insensitive",
            },
          }
        : {}),
    },
    orderBy: { start_date: "desc" },
    select: {
      id: true,
      name: true,
      type: true,
      start_date: true,
    },
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-black">All Activities</h1>
      <form className="mt-4">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by title"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </form>
      <div className="mt-4 grid grid-cols-1 gap-4">
        {activities.length === 0 && (
          <p className="text-sm text-slate-500">No activities found</p>
        )}
        {activities.map((a) => {
          const date = a.start_date
            ? new Date(a.start_date).toLocaleDateString()
            : "–";
          return (
            <Link
              key={a.id}
              href={`/activities/${a.id}`}
              className="block rounded-lg border border-slate-200 p-4 hover:bg-slate-50"
            >
              <div className="truncate text-sm font-medium text-slate-900">
                {a.name || a.type || "Activity"}
              </div>
              <div className="mt-1 text-xs text-slate-500">{date}</div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

