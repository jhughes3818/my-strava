"use client";
import { useEffect, useState } from "react";

type Latest = {
  fitness: number;
  fatigue: number;
  freshness: number;
  day: string;
};

export default function TrainingStatus() {
  const [latest, setLatest] = useState<Latest | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/metrics/daily-load", { cache: "no-store" });
      const j = await r.json();
      if (j.ok && j.latest) setLatest(j.latest);
    })();
  }, []);

  if (!latest) {
    return (
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Fitness</div>
          <div className="mt-1 text-lg font-semibold">–</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Fatigue</div>
          <div className="mt-1 text-lg font-semibold">–</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs text-slate-500">Freshness</div>
          <div className="mt-1 text-lg font-semibold">–</div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs text-slate-500">Fitness</div>
        <div className="mt-1 text-lg font-semibold text-indigo-600">
          {latest.fitness}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs text-slate-500">Fatigue</div>
        <div className="mt-1 text-lg font-semibold text-red-600">
          {latest.fatigue}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="text-xs text-slate-500">Freshness</div>
        <div
          className={`mt-1 text-lg font-semibold ${
            latest.freshness >= 0 ? "text-emerald-600" : "text-orange-600"
          }`}
        >
          {latest.freshness}
        </div>
      </div>
    </div>
  );
}
