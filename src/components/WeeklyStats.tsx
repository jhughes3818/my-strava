"use client";
import { useEffect, useState } from "react";

type Stats = { km: number; h: number; load: number };

function diffPct(curr: number, prev: number): string {
  if (prev === 0 && curr === 0) return "0%";
  if (prev === 0) return "+100%";
  const pct = ((curr - prev) / prev) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

export default function WeeklyStats() {
  const [curr, setCurr] = useState<Stats | null>(null);
  const [prev, setPrev] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/metrics/seven-day", { cache: "no-store" });
      const j = await r.json();
      if (j.ok) {
        setCurr(j.current);
        setPrev(j.prev);
      }
    })();
  }, []);

  return (
    <div className="grid grid-cols-3 gap-4">
      {[
        {
          label: "Distance",
          val: curr?.km ?? 0,
          prev: prev?.km ?? 0,
          unit: "km",
          color: "text-indigo-600",
        },
        {
          label: "Time",
          val: curr?.h ?? 0,
          prev: prev?.h ?? 0,
          unit: "h",
          color: "text-emerald-600",
        },
        {
          label: "Load",
          val: curr?.load ?? 0,
          prev: prev?.load ?? 0,
          unit: "",
          color: "text-rose-600",
        },
      ].map((s) => (
        <div
          key={s.label}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="text-xs text-slate-500">{s.label} (7d)</div>
          <div className={`mt-1 text-lg font-semibold ${s.color}`}>
            {s.val} {s.unit}
          </div>
          <div className="text-xs text-slate-500">
            vs prev: {diffPct(s.val, s.prev)}
          </div>
        </div>
      ))}
    </div>
  );
}
