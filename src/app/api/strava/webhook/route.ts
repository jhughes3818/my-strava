// app/api/strava/webhook/route.ts
import type { NextRequest } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: subscription validation */
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

/** POST: event delivery (no HMAC required by Strava) */
export async function POST(req: NextRequest) {
  // Read raw bytes once
  const raw = new Uint8Array(await req.arrayBuffer());

  // OPTIONAL: verify X-Strava-Signature if *present* (e.g., for your own test calls)
  const header = req.headers.get("x-strava-signature") || "";
  const provided = header.startsWith("sha256=") ? header.slice(7) : header;
  if (provided) {
    const secret = process.env.STRAVA_CLIENT_SECRET || "";
    const expected = crypto
      .createHmac("sha256", secret)
      .update(raw)
      .digest("hex");
    try {
      const a = Buffer.from(expected, "hex");
      const b = Buffer.from(provided, "hex");
      const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
      if (!ok) {
        // Don’t block Strava—just log mismatch and continue
        console.warn("[strava] optional HMAC mismatch (ignoring)");
      }
    } catch {
      console.warn("[strava] optional HMAC compare failed (ignoring)");
    }
  }

  // Parse now
  let evt: {
    object_type: "activity" | "athlete";
    object_id: number;
    aspect_type: "create" | "update" | "delete";
    owner_id: number;
    updates?: Record<string, unknown>;
    subscription_id?: number;
    event_time?: number;
  };
  try {
    evt = JSON.parse(Buffer.from(raw).toString("utf8"));
  } catch (e) {
    console.error("[strava] bad JSON", e);
    // Still 200 so Strava doesn't hammer retries
    return new Response("ok", { status: 200 });
  }

  // Only handle activities
  if (evt.object_type !== "activity")
    return new Response("ok", { status: 200 });

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
    console.error("[strava] handler error", e);
    // swallow to avoid retries
  }

  return new Response("ok", { status: 200 });
}

// unchanged
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
    if (!s) return;
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
