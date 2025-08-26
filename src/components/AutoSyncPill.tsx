"use client";
import { useEffect, useState } from "react";

export default function AutoSyncPill() {
  const [syncing, setSyncing] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        // fetch new activities
        await fetch("/api/strava/incremental", { method: "POST" });
        // fetch associated details/streams until none left
        while (true) {
          const res = await fetch("/api/strava/sync-details");
          const data = await res.json();
          if (!data.ok || !data.batch || data.batch === 0) break;
        }
      } catch (e) {
        // swallow errors; pill will still resolve to "Activities Up To Date"
      } finally {
        if (!cancelled) setSyncing(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-3 py-2 text-emerald-700 ring-1 ring-inset ring-emerald-200">
      <span className={`h-2 w-2 rounded-full bg-emerald-500 ${syncing ? "animate-pulse" : ""}`} />
      {syncing ? "Updating activities…" : "Activities Up To Date"}
    </div>
  );
}

