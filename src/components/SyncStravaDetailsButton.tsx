"use client";
import { useState } from "react";

export default function SyncStravaDetailsButton() {
  const [msg, setMsg] = useState<string>("");

  async function onClick() {
    setMsg("Syncing details & streams…");
    try {
      const r = await fetch("/api/strava/sync-details");
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "failed");
      setMsg(
        `Updated ${j.detailed} details and ${j.streamed} streams (batch ${j.batch}).`
      );
    } catch (e: any) {
      setMsg(`Error: ${e.message || "sync failed"}`);
    }
  }

  return (
    <div className="space-x-3">
      <button
        onClick={onClick}
        className="rounded-md border px-3 py-2 hover:bg-gray-50"
      >
        Fetch Details & Streams
      </button>
      {msg && <span className="text-sm text-gray-600">{msg}</span>}
    </div>
  );
}
