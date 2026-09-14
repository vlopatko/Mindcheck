"use client";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ScatterChart,
  Scatter,
  ZAxis,
} from "recharts";
const tooltip = {
  background: "#222729",
  border: "1px solid #454d4f",
  borderRadius: 8,
  color: "#eef0eb",
  fontSize: 14,
};
export function PerformanceChart({
  rows,
}: {
  rows: { date: string; adr: number | null; performance: number | null }[];
}) {
  if (!rows.some((r) => r.adr !== null || r.performance !== null))
    return (
      <div className="empty">
        Your trend will appear after you log match stats.
      </div>
    );
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={rows}
          margin={{ top: 12, right: 4, bottom: 8, left: -18 }}
        >
          <CartesianGrid
            stroke="#30383a"
            strokeDasharray="3 6"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            stroke="#9ca9a8"
            tick={{ fontSize: 12 }}
            tickFormatter={(s) => s.slice(5)}
            minTickGap={20}
          />
          <YAxis yAxisId="adr" stroke="#aab9a6" tick={{ fontSize: 12 }} />
          <YAxis
            yAxisId="rating"
            orientation="right"
            domain={[0, 10]}
            stroke="#9daacb"
            tick={{ fontSize: 12 }}
          />
          <Tooltip contentStyle={tooltip} labelStyle={{ color: "#eef0eb" }} />
          <Line
            yAxisId="adr"
            name="ADR"
            dataKey="adr"
            stroke="#c5f46b"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls={false}
            isAnimationActive={false}
          />
          <Line
            yAxisId="rating"
            name="Self-rating / 10"
            dataKey="performance"
            stroke="#99b5f8"
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function CorrelationChart({
  pairs,
  label,
}: {
  pairs: [number, number][];
  label: string;
}) {
  if (!pairs.length)
    return (
      <div className="empty">
        Log {label.toLowerCase()} and match ADR on the same day to see the
        relationship.
      </div>
    );
  return (
    <div className="chart-box">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 12, right: 24, bottom: 20, left: -5 }}>
          <CartesianGrid stroke="#30383a" strokeDasharray="3 6" />
          <XAxis
            type="number"
            dataKey="x"
            name={label}
            stroke="#9ca9a8"
            tick={{ fontSize: 12 }}
            label={{
              value: label,
              position: "insideBottom",
              offset: -14,
              fill: "#adb9b0",
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Daily average ADR"
            stroke="#9ca9a8"
            tick={{ fontSize: 12 }}
          />
          <ZAxis range={[65, 65]} />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={tooltip} />
          <Scatter
            name="Logged days"
            data={pairs.map(([x, y]) => ({ x, y }))}
            fill="#c5f46b"
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
