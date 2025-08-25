"use client";

import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
  const [meta, setMeta] = useState<{
    name?: string | null;
    type?: string | null;
    start?: string | null;
  }>({});
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

        // Build rows: t (mm:ss), hr (bpm), pace (min/km). Guard against 0 speeds.
        const rows: any[] = [];
        for (let i = 0; i < time.length; i++) {
          const t = time[i] ?? (i ? time[i - 1] + 1 : 0);
          const secsPerKm = v[i] > 0 ? 1000 / v[i] : null; // seconds to cover 1km
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
          setMeta({
            name: j.activity?.name,
            type: j.activity?.type,
            start: j.activity?.start_date,
          });
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

      <div className="h-72 w-full">
        <ResponsiveContainer>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="tLabel" minTickGap={24} />
            {/* Left axis: Heart rate (bpm) */}
            <YAxis yAxisId="left" domain={["auto", "auto"]} />
            {/* Right axis: Pace (sec/km). We'll invert visually by mapping ticks in the tooltip/legend */}
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={["auto", "auto"]}
            />
            <Tooltip
              formatter={(value: any, name) => {
                if (name === "pace (min/km)") {
                  const secs = Number(value);
                  if (!isFinite(secs) || secs <= 0) return ["–", name];
                  const m = Math.floor(secs / 60);
                  const s = Math.round(secs % 60);
                  return [`${m}:${String(s).padStart(2, "0")}`, name];
                }
                return [value, name];
              }}
              labelFormatter={(l) => `t = ${l}`}
            />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="hr"
              name="HR (bpm)"
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="pace"
              name="pace (min/km)"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
