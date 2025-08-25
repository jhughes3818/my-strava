"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type ActivityListItem = {
  id: string;
  name: string | null;
  type: string | null;
  start_date: string | null;
};

export default function ActivityChart({
  activities,
}: {
  activities: ActivityListItem[];
}) {
  const [selected, setSelected] = useState<string>(activities[0]?.id ?? "");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const r = await fetch(`/api/activities/${selected}/streams`);
        const j = await r.json();
        if (!j.ok) throw new Error(j.error || "failed");

        const time: number[] = j.streams.time ?? [];
        const hr: number[] = j.streams.heartrate ?? [];
        const v: number[] = j.streams.velocity_smooth ?? [];

        // Smooth velocity and filter out stops so the pace chart is readable
        const window = 5; // seconds for simple moving average
        let sum = 0;
        const rows: any[] = [];
        for (let i = 0; i < time.length; i++) {
          const t = time[i] ?? (i ? time[i - 1] + 1 : 0);
          const val = v[i] ?? 0;
          sum += val;
          if (i >= window) sum -= v[i - window] ?? 0;
          const avgV = sum / Math.min(i + 1, window);
          let secsPerKm = avgV > 0 ? 1000 / avgV : null; // seconds to cover 1km
          // Drop unrealistically slow paces from stops (>10 min/km)
          if (secsPerKm && secsPerKm > 600) secsPerKm = null;
          const paceMin = secsPerKm ? Math.floor(secsPerKm / 60) : null;
          const paceSec = secsPerKm ? Math.round(secsPerKm % 60) : null;
          rows.push({
            t, // seconds from start
            tLabel: `${Math.floor(t / 60)}:${String(
              Math.floor(t % 60)
            ).padStart(2, "0")}`,
            hr: hr[i] ?? null,
            pace: secsPerKm, // numeric seconds/km for axis
            paceLabel:
              paceMin !== null && paceSec !== null
                ? `${paceMin}:${String(paceSec).padStart(2, "0")}`
                : null,
          });
        }

        if (!cancelled) {
          setData(rows);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e.message || "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const title = useMemo(() => {
    const a = activities.find((a) => a.id === selected);
    if (!a) return "Activity";
    const when = a.start_date ? new Date(a.start_date).toLocaleString() : "";
    return `${a.name ?? a.type ?? "Activity"} • ${when}`;
  }, [activities, selected]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600">Activity:</label>
        <select
          className="rounded-md border px-2 py-1"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {activities.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name || a.type || "Activity"} —{" "}
              {a.start_date ? new Date(a.start_date).toLocaleDateString() : ""}
            </option>
          ))}
        </select>
        {loading && (
          <span className="text-sm text-gray-500">Loading streams…</span>
        )}
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>

      <div className="text-sm text-gray-700">{title}</div>

      <div className="space-y-8">
        <div>
          <h2 className="mb-2 text-lg font-semibold text-black">Heart Rate</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tLabel" minTickGap={24} />
                <YAxis domain={["auto", "auto"]} />
                <Tooltip labelFormatter={(l) => `t = ${l}`} />
                <Line
                  type="monotone"
                  dataKey="hr"
                  name="HR (bpm)"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div>
          <h2 className="mb-2 text-lg font-semibold text-black">Pace</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="tLabel" minTickGap={24} />
                <YAxis
                  domain={["auto", "auto"]}
                  tickFormatter={(secs) => {
                    const m = Math.floor(Number(secs) / 60);
                    const s = Math.round(Number(secs) % 60);
                    return `${m}:${String(s).padStart(2, "0")}`;
                  }}
                />
                <Tooltip
                  formatter={(value: any) => {
                    const secs = Number(value);
                    if (!isFinite(secs) || secs <= 0) return "–";
                    const m = Math.floor(secs / 60);
                    const s = Math.round(secs % 60);
                    return `${m}:${String(s).padStart(2, "0")}`;
                  }}
                  labelFormatter={(l) => `t = ${l}`}
                />
                <Line
                  type="monotone"
                  dataKey="pace"
                  name="pace (min/km)"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
