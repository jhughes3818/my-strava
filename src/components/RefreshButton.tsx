// src/components/RefreshButton.tsx
"use client";
import { useState } from "react";

export default function RefreshButton() {
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setMsg("Refreshing…");
    try {
      const r = await fetch("/api/strava/refresh", { method: "POST" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "failed");
      setMsg(
        `Checked ${j.checked} • missing ${j.missing} • added ${j.added} • streamed ${j.streamed}`
      );
    } catch (e: any) {
      setMsg(`Error: ${e.message || "failed"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="inline-flex items-center gap-3">
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {loading ? "Refreshing…" : "Refresh Activities"}
      </button>
      {msg && <span className="text-sm text-slate-600">{msg}</span>}
    </div>
  );
}
