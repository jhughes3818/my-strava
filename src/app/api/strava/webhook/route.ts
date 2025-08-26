import { NextRequest } from "next/server";
import { db } from "@/lib/db";

/**
 * Strava webhook verification (one-time, when you create the subscription):
 * Strava calls GET ?hub.mode=subscribe&hub.challenge=...&hub.verify_token=...
 * You must echo back {"hub.challenge": "..."} when verify_token matches.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const challenge = searchParams.get("hub.challenge");
  const token = searchParams.get("hub.verify_token");

  if (
    mode === "subscribe" &&
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
 * Event delivery: Strava POSTs JSON and includes X-Strava-Signature = HMAC-SHA256(body, CLIENT_SECRET)
 * We validate the signature, then react to aspect_type (create/update/delete).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-strava-signature"); // HMAC hex
  const ok = await verifyStravaSignature(
    raw,
    sig ?? "",
    process.env.STRAVA_CLIENT_SECRET!
  );
  if (!ok) return new Response("Bad signature", { status: 401 });

  const evt = JSON.parse(raw) as {
    object_type: "activity" | "athlete";
    object_id: number;
    aspect_type: "create" | "update" | "delete";
    owner_id: number; // athlete id
    updates?: Record<string, unknown>;
  };

  // We only care about activities
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
        if (acct) {
          await fetchAndStoreActivity(acct.userId, activityId);
        }
        break;
      }

      case "update": {
        // If the activity was made private or otherwise unauthorized, remove it.
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
          if (acct) {
            await fetchAndStoreActivity(acct.userId, activityId);
          }
        }
        break;
      }

      case "delete": {
        // 🔥 Hard-delete locally (streams row will cascade delete)
        await db.activity.delete({ where: { id: activityId } }).catch(() => {});
        break;
      }
    }
  } catch (e) {
    console.error("Strava webhook error", e);
    // Always 200 so Strava doesn’t retry forever; you can add your own retry queue if desired.
  }

  return new Response("ok", { status: 200 });
}

async function fetchAndStoreActivity(userId: string, activityId: string) {
  const {
    ensureStravaAccessToken,
    getActivityDetail,
    getActivityStreams,
  } = await import("@/lib/strava");
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

// --- utils ---
async function verifyStravaSignature(
  body: string,
  signature: string,
  clientSecret: string
) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(clientSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sigBytes = hexToBytes(signature);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes,
    enc.encode(body)
  );
  return valid;
}

function hexToBytes(hex: string) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++)
    arr[i] = parseInt(hex.substr(i * 2, 2), 16);
  return arr;
}
