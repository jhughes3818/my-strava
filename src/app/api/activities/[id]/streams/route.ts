import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> } // 👈 note Promise here
) {
  const { id } = await params; // 👈 await it

  const session = await getServerSession(authOptions);
  if (!session?.user)
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const userId = (session.user as any).id as string | undefined;
  if (!userId) return json({ ok: false, error: "No user id" }, { status: 401 });

  const activity = await db.activity.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      name: true,
      type: true,
      start_date: true,
    },
  });
  if (!activity || activity.userId !== userId) {
    return json({ ok: false, error: "Not found" }, { status: 404 });
  }

  const streams = await db.activityStream.findUnique({
    where: { activityId: id },
    select: {
      time: true,
      heartrate: true,
      velocity_smooth: true,
      altitude: true,
      cadence: true,
      watts: true,
      grade_smooth: true,
      latlng: true,
    },
  });

  if (!streams)
    return json(
      { ok: false, error: "No streams for this activity" },
      { status: 404 }
    );

  return json({ ok: true, activity, streams });
}
