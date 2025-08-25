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
        // Pull the single activity and upsert (idempotent)
        const { ensureStravaAccessToken } = await import("@/lib/strava");
        const { upsertActivity } = await import("@/lib/strava-sync");

        // Find the user by athlete_id mapping in Account
        const acct = await db.account.findFirst({
          where: { provider: "strava", athlete_id: String(evt.owner_id) },
          select: { userId: true },
        });
        if (!acct) break;

        // Ensure we have a valid token then fetch detail and/or list page item
        const token = await ensureStravaAccessToken(acct.userId);
        const detail = await fetch(
          `https://www.strava.com/api/v3/activities/${activityId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
          }
        );
        if (detail.ok) {
          const a = await detail.json();
          await upsertActivity(acct.userId, a);
        }
        break;
      }

      case "update": {
        // If the activity was made private or otherwise unauthorized, you may want to remove it locally.
        // Strava sends updates like { "title": "...", "type": "...", "private": "true" }
        const becamePrivate =
          evt.updates && (evt.updates as any).private === "true";
        if (becamePrivate) {
          await db.activity
            .delete({ where: { id: activityId } })
            .catch(() => {});
        } else {
          // For other updates, you could re-fetch detail and update the row
          const acct = await db.account.findFirst({
            where: { provider: "strava", athlete_id: String(evt.owner_id) },
            select: { userId: true },
          });
          if (acct) {
            const { ensureStravaAccessToken } = await import("@/lib/strava");
            const token = await ensureStravaAccessToken(acct.userId);
            const r = await fetch(
              `https://www.strava.com/api/v3/activities/${activityId}`,
              {
                headers: { Authorization: `Bearer ${token}` },
                cache: "no-store",
              }
            );
            if (r.ok) {
              const a = await r.json();
              const { upsertActivity } = await import("@/lib/strava-sync");
              await upsertActivity(acct.userId, a);
            }
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
