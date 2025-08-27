// src/components/RefreshButton.tsx
"use client";
import { useState } from "react";

export default function RefreshButton() {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    try {
      const r = await fetch("/api/strava/refresh", { method: "POST" });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || "failed");
      setToast(`Added ${j.added} activities`);
    } catch (e: any) {
      setToast(`Error: ${e.message || "failed"}`);
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 3000);
    }
  }

  return (
    <>
      <button
        onClick={run}
        disabled={loading}
        className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 shadow-sm hover:bg-slate-50 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {loading ? "Refreshing…" : "Refresh Activities"}
      </button>
      {toast && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded bg-slate-800 px-4 py-2 text-sm text-white shadow">
          {toast}
        </div>
      )}
    </>
  );
}

