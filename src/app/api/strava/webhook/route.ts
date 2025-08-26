// app/api/strava/webhook/route.ts
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

// Ensure Node runtime (not Edge)
export const runtime = "nodejs";
// Avoid caching weirdness
export const dynamic = "force-dynamic";

/**
 * GET: Strava webhook verification
 * Strava calls: ?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...
 * You must echo {"hub.challenge": "..."} when the verify token matches.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const challenge = searchParams.get("hub.challenge");
  const token = searchParams.get("hub.verify_token");

  if (
    mode === "subscribe" &&
    token &&
    token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
  ) {
    return new Response(JSON.stringify({ "hub.challenge": challenge }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  }

  return new Response("Forbidden", { status: 403 });
}

/**
 * POST: Strava event delivery
 * Header: X-Strava-Signature: sha256=<hex> (HMAC-SHA256 over the raw request body using your APP CLIENT SECRET)
 */
export async function POST(req: NextRequest) {
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientSecret) {
    console.error("[strava] Missing STRAVA_CLIENT_SECRET");
    // Return 200 to avoid endless retries from Strava; you can alert internally instead.
    return new Response("missing secret", { status: 200 });
  }

  // Read exact raw bytes of the request body (no JSON parsing yet)
  const raw = new Uint8Array(await req.arrayBuffer());

  // Signature header (case-insensitive)
  const header = req.headers.get("x-strava-signature") || "";
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;

  // ---- Optional debug: only responds if you send X-Debug-Sig: 1 ----
  if (req.headers.get("x-debug-sig") === "1") {
    const expectedHex = crypto
      .createHmac("sha256", clientSecret)
      .update(raw)
      .digest("hex");
    return new Response(
      JSON.stringify({
        envSeen: true,
        clientSecretLen: clientSecret.length,
        runtime: (globalThis as any).EdgeRuntime ? "edge" : "node",
        haveHeader: !!header,
        providedLen: provided.length,
        expectedLen: expectedHex.length,
        provided,
        expectedHex,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
  // ------------------------------------------------------------------

  // Compute expected signature over the raw bytes
  const expectedHex = crypto
    .createHmac("sha256", clientSecret)
    .update(raw)
    .digest("hex");

  // Constant-time compare
  let valid = false;
  try {
    const a = Buffer.from(expectedHex, "hex");
    const b = Buffer.from(provided, "hex");
    valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    valid = false;
  }

  if (!valid) {
    console.error("[strava] Bad signature", {
      haveHeader: !!header,
      providedLen: provided.length,
      expectedLen: expectedHex.length,
    });
    return new Response("Bad signature", { status: 401 });
  }

  // Safe to parse now
  const evt = JSON.parse(Buffer.from(raw).toString("utf8")) as {
    object_type: "activity" | "athlete";
    object_id: number;
    aspect_type: "create" | "update" | "delete";
    owner_id: number; // athlete id
    updates?: Record<string, unknown>;
    subscription_id?: number;
    event_time?: number;
  };

  // Ignore non-activity events
  if (evt.object_type !== "activity")
    return new Response("ignored", { status: 200 });

  const activityId = String(evt.object_id);

  try {
    switch (evt.aspect_type) {
      case "create": {
        const acct = await db.account.findFirst({
          where: { provider: "strava", athlete_id: String(evt.owner_id) },
          select: { userId: true },
        });
        if (acct) await fetchAndStoreActivity(acct.userId, activityId);
        break;
      }

      case "update": {
        const becamePrivate =
          evt.updates && (evt.updates as any).private === "true";
        if (becamePrivate) {
          await db.activity
            .delete({ where: { id: activityId } })
            .catch(() => {});
        } else {
          const acct = await db.account.findFirst({
            where: { provider: "strava", athlete_id: String(evt.owner_id) },
            select: { userId: true },
          });
          if (acct) await fetchAndStoreActivity(acct.userId, activityId);
        }
        break;
      }

      case "delete": {
        await db.activity.delete({ where: { id: activityId } }).catch(() => {});
        break;
      }
    }
  } catch (e) {
    console.error("[strava] Handler error", e);
    // Still return 200 so Strava doesn't hammer you with retries.
  }

  return new Response("ok", { status: 200 });
}

/** Your existing sync function (unchanged) */
async function fetchAndStoreActivity(userId: string, activityId: string) {
  const { ensureStravaAccessToken, getActivityDetail, getActivityStreams } =
    await import("@/lib/strava");
  const { upsertActivity } = await import("@/lib/strava-sync");

  const token = await ensureStravaAccessToken(userId);
  const d = await getActivityDetail(activityId, token);
  await upsertActivity(userId, d);

  await db.activity.update({
    where: { id: activityId },
    data: {
      raw_detail: d as any,
      avg_hr: d.average_heartrate ?? null,
      max_hr: d.max_heartrate ?? null,
      avg_speed: d.average_speed ?? null,
      avg_cadence: d.average_cadence ?? null,
      avg_watts: d.average_watts ?? null,
      calories: d.calories ?? null,
      device_name: d.device_name ?? null,
      map_polyline: d.map?.summary_polyline ?? null,
    },
  });

  try {
    const s = await getActivityStreams(activityId, token);
    await db.activityStream.upsert({
      where: { activityId },
      create: {
        activityId,
        time: s.time?.data ?? null,
        heartrate: s.heartrate?.data ?? null,
        velocity_smooth: s.velocity_smooth?.data ?? null,
        altitude: s.altitude?.data ?? null,
        cadence: s.cadence?.data ?? null,
        watts: s.watts?.data ?? null,
        grade_smooth: s.grade_smooth?.data ?? null,
        latlng: s.latlng?.data ?? null,
      },
      update: {
        time: s.time?.data ?? null,
        heartrate: s.heartrate?.data ?? null,
        velocity_smooth: s.velocity_smooth?.data ?? null,
        altitude: s.altitude?.data ?? null,
        cadence: s.cadence?.data ?? null,
        watts: s.watts?.data ?? null,
        grade_smooth: s.grade_smooth?.data ?? null,
        latlng: s.latlng?.data ?? null,
      },
    });

    await db.activity.update({
      where: { id: activityId },
      data: { has_streams: true },
    });
  } catch (e) {
    console.error("stream error", activityId, e);
  }
}
