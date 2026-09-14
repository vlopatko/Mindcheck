"use client";
import { useState } from "react";
import { Activity, GitCompareArrows } from "lucide-react";
import { useData } from "@/components/data-provider";
import { Choice } from "@/components/fields";
import { CorrelationChart } from "@/components/charts";
import { correlation, compareHabit } from "@/lib/analytics";
import { DailyLog, display } from "@/lib/model";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
const factors: [keyof DailyLog, string][] = [
  ["sleepHours", "Sleep hours"],
  ["energy", "Energy"],
  ["focus", "Focus"],
  ["stress", "Stress"],
  ["tilt", "Tilt"],
  ["warmupMinutes", "Warmup minutes"],
];
const habits: [keyof DailyLog, string][] = [
  ["sleepOk", "Slept well"],
  ["warmup", "Warmed up"],
  ["ateBeforeSession", "Ate before playing"],
  ["hydrated", "Stayed hydrated"],
  ["physicalActivity", "Physical activity"],
];
export default function Analytics() {
  const { data, loading } = useData();
  const [factor, setFactor] = useState<keyof DailyLog>("sleepHours");
  const [habit, setHabit] = useState<keyof DailyLog>("warmup");
  const selected = correlation(data, factor);
  const groups = compareHabit(data, habit);
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">PATTERNS, NOT ASSUMPTIONS</p>
          <h1>
            Find your patterns.
            <br />
            <span>One day at a time.</span>
          </h1>
        </div>
      </div>
      {loading && <p role="status">Loading analytics…</p>}
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-title">
            <Activity />
            <h2>State × performance</h2>
          </div>
          <div className="toolbar">
            <Choice
              label="Correlation factor"
              value={factor}
              onChange={(v) => setFactor((v ?? "sleepHours") as keyof DailyLog)}
              options={factors as [string, string][]}
            />
            <span className="muted">Daily average ADR</span>
          </div>
          <CorrelationChart
            pairs={selected.pairs}
            label={factors.find((f) => f[0] === factor)![1]}
          />
          <div className="correlation-note">
            <strong>r = {display(selected.r, 2)}</strong>
            <span>{selected.n} paired days</span>
            <span>
              {selected.n < 3
                ? "At least 3 paired days needed"
                : selected.r === null
                  ? "Not enough variation to calculate r"
                  : selected.n < 10
                    ? "Early pattern · small sample"
                    : "Pearson correlation"}
            </span>
          </div>
        </section>
        <aside className="panel">
          <h2>How to read this</h2>
          <p className="hint">
            Each point is one day with a check-in and at least one recorded
            match ADR. Multiple matches are averaged within that day.
          </p>
          <p className="hint">
            A positive r means the values tend to rise together. A negative r
            means they tend to move in opposite directions.
          </p>
          <p className="hint">
            Small samples are unstable. Correlation does not establish cause:
            map, teammates, opponents and platform can also affect performance.
          </p>
          <p className="hint">
            Missing values are excluded; an actual zero is kept.
          </p>
        </aside>
      </div>
      <section className="panel section-gap">
        <div className="panel-title">
          <GitCompareArrows />
          <h2>Preparation comparison</h2>
        </div>
        <div className="toolbar">
          <Choice
            label="Preparation habit"
            value={habit}
            onChange={(v) => setHabit((v ?? "warmup") as keyof DailyLog)}
            options={habits as [string, string][]}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              {[
                "Answer",
                "Logged days",
                "Matches",
                "Average ADR",
                "Overall K/D",
                "Win rate",
              ].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((g) => (
              <TableRow key={String(g.value)}>
                <TableCell>{g.value ? "Yes" : "No"}</TableCell>
                <TableCell>{g.days}</TableCell>
                <TableCell>{g.matches}</TableCell>
                <TableCell>{display(g.adr)}</TableCell>
                <TableCell>{display(g.kd, 2)}</TableCell>
                <TableCell>
                  {g.winRate === null ? "—" : `${display(g.winRate, 0)}%`}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="hint">
          Unanswered checkboxes are excluded. ADR averages recorded matches; K/D
          uses paired kill/death totals. Draws count in the win-rate
          denominator.
        </p>
      </section>
      <section className="panel section-gap">
        <h2>Correlation overview</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Daily factor</TableHead>
              <TableHead>Paired days</TableHead>
              <TableHead>Pearson r · ADR</TableHead>
              <TableHead>Sample</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {factors.map(([key, label]) => {
              const c = correlation(data, key);
              return (
                <TableRow key={key}>
                  <TableCell>{label}</TableCell>
                  <TableCell>{c.n}</TableCell>
                  <TableCell>{display(c.r, 2)}</TableCell>
                  <TableCell>
                    {c.n < 3
                      ? "Insufficient data"
                      : c.r === null
                        ? "No variation"
                        : c.n < 10
                          ? "Small sample"
                          : "Exploratory"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>
    </>
  );
}
