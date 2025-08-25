// WeeklyVolumeChart.tsx
"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";

type Row = { weekStart: string; km: number; hours: number };

export default function WeeklyVolumeChart({ weeks = 13 }: { weeks?: number }) {
  const [data, setData] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const r = await fetch(`/api/metrics/weekly-volume?weeks=${weeks}`, {
          cache: "no-store",
        });
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "failed");
        const rows: Row[] = (j.data as any[]).map((d) => ({
          weekStart: d.weekStart,
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
  }, [weeks]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-black">Weekly Volume</h3>
        {loading && <span className="text-sm text-gray-500">Loading…</span>}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="weekStart"
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
            <Bar
              yAxisId="left"
              dataKey="km"
              name="Distance (km)"
              fill="#8884d8"
            />
            <Bar
              yAxisId="right"
              dataKey="hours"
              name="Time (h)"
              fill="#82ca9d"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
