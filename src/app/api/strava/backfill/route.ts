import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { json } from "@/lib/http";
import { getStravaAccountForUser } from "@/lib/strava";
import { backfillAllActivities } from "@/lib/strava-sync";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user)
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as any).id as string;

  const acct = await getStravaAccountForUser(userId);
  if (!acct)
    return json({ ok: false, error: "Strava not linked" }, { status: 400 });

  const res = await backfillAllActivities(userId);
  return json({ ok: true, ...res });
}
