// FitnessFreshnessChart.tsx
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

type Row = { day: string; load: number };

export default function FitnessFreshnessChart({
  days = 90,
}: {
  days?: number;
}) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/metrics/daily-load", { cache: "no-store" });
      const j = await r.json();
      if (!j.ok) return;
      const rows: Row[] = j.data;

      const tauATL = 7;
      const tauCTL = 42;
      let atl = 0,
        ctl = 0;
      const kATL = 1 - Math.exp(-1 / tauATL);
      const kCTL = 1 - Math.exp(-1 / tauCTL);

      const out: any[] = [];
      for (let i = 0; i < rows.length; i++) {
        const { day, load } = rows[i];
        atl = atl + kATL * (load - atl);
        ctl = ctl + kCTL * (load - ctl);
        const tsb = ctl - atl;
        out.push({
          day,
          load,
          fitness: +ctl.toFixed(2),
          fatigue: +atl.toFixed(2),
          freshness: +tsb.toFixed(2),
        });
      }
      setData(out);
    })();
  }, []);

  const visibleData = days ? data.slice(-days) : data;

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-medium text-black">
        Fitness vs Fatigue vs Freshness
      </h3>
      <div className="h-80 w-full">
        <ResponsiveContainer>
          <LineChart data={visibleData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="day"
              tickFormatter={(v) => new Date(v).toLocaleDateString()}
              tick={{ fill: "#334155", fontSize: 12 }}
              minTickGap={24}
            />
            <YAxis />
            <Tooltip
              labelFormatter={(v) => new Date(v).toLocaleDateString()}
              labelStyle={{ color: "black", fontWeight: 500 }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="fitness"
              name="Fitness (CTL)"
              stroke="#4f46e5"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="fatigue"
              name="Fatigue (ATL)"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="freshness"
              name="Freshness (TSB)"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
