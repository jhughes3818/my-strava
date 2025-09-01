// RollingVolumeChart.tsx
"use client";

import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type Row = { day: string; km: number; hours: number };

export default function RollingVolumeChart({
  days = 90,
}: {
  days?: number | "max";
}) {
  const [data, setData] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [windowSize, setWindowSize] = useState<7 | 30>(7);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const r = await fetch(
          `/api/metrics/rolling-volume?days=${days}&window=${windowSize}`,
          { cache: "no-store" }
        );
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "failed");
        const rows: Row[] = (j.data as any[]).map((d) => ({
          day: d.day,
          km: d.km,
          hours: d.hours,
        }));
        if (!cancelled) setData(rows);
      } catch (e: any) {
        if (!cancelled) setErr(e.message || "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days, windowSize]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-black">Rolling Volume</h3>
        <div className="flex gap-1">
          {[7, 30].map((w) => {
            const active = w === windowSize;
            return (
              <button
                key={w}
                type="button"
                onClick={() => setWindowSize(w as 7 | 30)}
                aria-pressed={active}
                className={[
                  "px-2 py-1 text-xs rounded-md border transition",
                  active
                    ? "bg-black text-white border-black"
                    : "bg-white text-gray-800 border-gray-300 hover:bg-gray-50",
                ].join(" ")}
              >
                {w}d
              </button>
            );
          })}
        </div>
        {loading && <span className="text-sm text-gray-500">Loading…</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="day"
              tickFormatter={(v) =>
                new Date(v).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })
              }
              minTickGap={24}
            />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              labelFormatter={(v) => new Date(v).toLocaleDateString()}
              labelStyle={{ color: "black", fontWeight: 500 }}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="km"
              name="Avg Distance (km)"
              stroke="#8884d8"
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="hours"
              name="Avg Time (h)"
              stroke="#82ca9d"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
