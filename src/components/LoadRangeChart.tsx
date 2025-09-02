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
  Area,
} from "recharts";

// Row from API
type Raw = {
  day: string;
  load: number;
  fitness: number;
};

// Row for chart
interface Row {
  day: string;
  load7: number;
  optLow: number;
  optHigh: number;
  optRange: number;
}

export default function LoadRangeChart({
  days = 90,
}: {
  days?: number | "max";
}) {
  const [data, setData] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/metrics/daily-load", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) return;
      const rows: Raw[] = j.data;
      const out: Row[] = [];
      for (let i = 0; i < rows.length; i++) {
        const slice = rows.slice(Math.max(0, i - 6), i + 1);
        const load7 = slice.reduce((s, d) => s + d.load, 0);
        const fitness = rows[i].fitness ?? 0;
        const lower = fitness * 0.8 * 7; // 80% of CTL * 7
        const upper = fitness * 1.2 * 7; // 120% of CTL * 7
        out.push({
          day: rows[i].day,
          load7: +load7.toFixed(2),
          optLow: +lower.toFixed(2),
          optHigh: +upper.toFixed(2),
          optRange: +(upper - lower).toFixed(2),
        });
      }
      setData(out);
    })();
  }, []);

  const visibleData = days === "max" ? data : data.slice(-days);
  const latest = data[data.length - 1];
  const over = latest && latest.load7 > latest.optHigh;
  const lineColor = over ? "#ef4444" : "#3b82f6"; // red when overreaching

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-black">Training Load Range</h3>
        {latest && (
          <span
            className={`text-sm font-medium ${
              over ? "text-red-600" : "text-emerald-600"
            }`}
          >
            {over ? "Over Reaching" : "Within Range"}
          </span>
        )}
      </div>
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <LineChart data={visibleData}>
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
            <YAxis />
            <Tooltip
              labelFormatter={(v) => new Date(v).toLocaleDateString()}
              labelStyle={{ color: "black", fontWeight: 500 }}
            />
            <Legend />
            {/* Optimal range shaded */}
            <Area
              type="monotone"
              dataKey="optLow"
              stackId="range"
              stroke="none"
              fill="none"
            />
            <Area
              type="monotone"
              dataKey="optRange"
              name="Optimal Range"
              stackId="range"
              stroke="none"
              fill="rgba(16,185,129,0.3)"
            />
            <Line
              type="monotone"
              dataKey="load7"
              name="7-day Load"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

