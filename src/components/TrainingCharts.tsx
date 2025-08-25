// TrainingCharts.tsx
"use client";

import { useState } from "react";
import WeeklyVolumeChart from "./WeeklyVolumeChart";
import FitnessFreshnessChart from "./FitnessFreshnessChart";

const PRESETS = [
  { label: "1M", days: 30, weeks: 4 },
  { label: "3M", days: 90, weeks: 13 },
  { label: "6M", days: 180, weeks: 26 },
  { label: "12M", days: 365, weeks: 52 },
];

export default function TrainingCharts() {
  const [range, setRange] = useState(PRESETS[1]); // default 3M

  return (
    <section className="mt-8">
      {/* Single time selector controlling both charts */}
      <div className="mb-3 flex justify-start gap-1">
        {PRESETS.map((p) => {
          const active = p.label === range.label;
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => setRange(p)}
              aria-pressed={active}
              className={[
                "px-2.5 py-1.5 text-sm rounded-md border transition",
                active
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50",
              ].join(" ")}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Both charts read from the same selection */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
        <WeeklyVolumeChart weeks={range.weeks} />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4">
        <FitnessFreshnessChart days={range.days} />
      </div>
    </section>
  );
}
