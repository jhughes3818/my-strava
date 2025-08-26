import { db } from "@/lib/db";

const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";

// Return the user's Strava Account row (or null)
export async function getStravaAccountForUser(userId: string) {
  return db.account.findFirst({
    where: { userId, provider: "strava" },
    select: {
      userId: true,
      provider: true,
      providerAccountId: true, // Strava athlete id (as string)
      access_token: true,
      refresh_token: true,
      expires_at: true, // epoch seconds
      token_type: true,
      scope: true,
      athlete_id: true,
    },
  });
}

// Ensure we have a valid access token for Strava calls
export async function ensureStravaAccessToken(userId: string): Promise<string> {
  const acct = await getStravaAccountForUser(userId);
  if (!acct) throw new Error("No Strava account linked for this user.");

  const nowS = Math.floor(Date.now() / 1000);
  const safetyWindow = 120; // 2 min buffer

  if (
    acct.access_token &&
    acct.expires_at &&
    acct.expires_at > nowS + safetyWindow
  ) {
    return acct.access_token;
  }

  if (!acct.refresh_token) {
    throw new Error("Missing Strava refresh token.");
  }

  // Refresh
  const body = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID!,
    client_secret: process.env.STRAVA_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: acct.refresh_token,
  });

  const resp = await fetch(STRAVA_TOKEN_URL, { method: "POST", body });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Strava token refresh failed: ${resp.status} ${text}`);
  }

  const json = (await resp.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at: number; // epoch seconds
    token_type?: string;
    scope?: string;
    athlete?: unknown;
  };

  // Persist new tokens
  await db.account.update({
    where: {
      provider_providerAccountId: {
        provider: "strava",
        providerAccountId: acct.providerAccountId,
      },
    },
    data: {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_at: json.expires_at,
      token_type: json.token_type,
      scope: json.scope,
      // keep athlete json if Strava returns it again (harmless if undefined)
      athlete: (json as any).athlete ?? undefined,
    },
  });

  return json.access_token;
}

export async function listAthleteActivities(
  accessToken: string,
  page = 1,
  perPage = 50
) {
  const url = new URL("https://www.strava.com/api/v3/athlete/activities");
  url.searchParams.set("page", String(page));
  url.searchParams.set("per_page", String(perPage));

  const r = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
    // Strava is fine with server-to-server calls; no cache
    cache: "no-store",
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Strava /athlete/activities failed: ${r.status} ${t}`);
  }
  return (await r.json()) as any[];
}

export async function getActivityDetail(
  activityId: string,
  accessToken: string
) {
  const r = await fetch(
    `https://www.strava.com/api/v3/activities/${activityId}?include_all_efforts=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    }
  );
  if (!r.ok) {
    const t = await r.text();
    throw new Error(
      `Strava /activities/${activityId} failed: ${r.status} ${t}`
    );
  }
  return (await r.json()) as any;
}

export async function getActivityStreams(
  activityId: string,
  accessToken: string
): Promise<Record<string, { data: any[] }> | null> {
  const keys = [
    "time",
    "heartrate",
    "velocity_smooth",
    "altitude",
    "cadence",
    "watts",
    "grade_smooth",
    "latlng",
  ].join(",");
  const url = `https://www.strava.com/api/v3/activities/${activityId}/streams?keys=${keys}&key_by_type=true`;

  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (r.status === 404) {
    // Streams may not be ready or activity may lack them.
    return null;
  }
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Strava streams ${activityId} failed: ${r.status} ${t}`);
  }
  // returns { time: { data: [...] }, heartrate: { data: [...] }, ... }
  return (await r.json()) as Record<string, { data: any[] }>;
}
