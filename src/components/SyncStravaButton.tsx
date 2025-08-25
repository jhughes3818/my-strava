"use client";

import { useState } from "react";

export default function SyncStravaButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle"
  );
  const [msg, setMsg] = useState("");

  async function onClick() {
    setStatus("loading");
    setMsg("");
    try {
      const r = await fetch("/api/strava/sync", { method: "GET" });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || "Sync failed");
      setStatus("done");
      setMsg(
        `Fetched ${j.fetched}, created ${j.created}, updated ${j.updated}`
      );
    } catch (e: any) {
      setStatus("error");
      setMsg(e.message || "Error");
    }
  }

  return (
    <div className="space-x-2">
      <button
        onClick={onClick}
        className="rounded-md border px-3 py-2 hover:bg-gray-50 disabled:opacity-50"
        disabled={status === "loading"}
      >
        {status === "loading" ? "Syncing…" : "Sync Strava Now"}
      </button>
      {msg && <span className="text-sm text-gray-600">{msg}</span>}
    </div>
  );
}
