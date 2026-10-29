"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CalendarCheck,
  Plus,
  Target,
  Activity,
} from "lucide-react";
import { useData } from "@/components/data-provider";
import { dailyRows, average, kd, winRate } from "@/lib/analytics";
import { display, formatDate, localDate } from "@/lib/model";
import { PerformanceChart } from "@/components/charts";
import type { ImpactScore, MetricValue } from "@/lib/demo-parser/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
export default function Dashboard() {
  const router = useRouter();
  const { data, loading } = useData();
  const [demoReports, setDemoReports] = useState<Array<{
    id: string;
    sourceMatchId?: string;
    impact: ImpactScore;
    metrics: { kills: MetricValue; deaths: MetricValue; assists: MetricValue; adr: MetricValue };
  }>>([]);
  useEffect(() => {
    void fetch("/api/demo-parser/reports", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : { reports: [] })
      .then((value) => setDemoReports(value.reports ?? []))
      .catch(() => setDemoReports([]));
  }, []);
  const checked = data.dailyLogs.filter((d) => d.checkedInAt);
  const rows = dailyRows(data);
  const today = data.dailyLogs.find((d) => d.date === localDate());
  const outcomes = data.matches.filter((m) => m.result !== null).length;
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">PLAYER OVERVIEW</p>
          <h1>
            Your game,
            <br />
            <span>in context.</span>
          </h1>
        </div>
        <Link className="primary" href="/check-in">
          <CalendarCheck size={18} />
          {today?.checkedInAt ? "Edit today’s check-in" : "Check in today"}
        </Link>
      </div>
      {loading ? (
        <p role="status" className="loading">
          Loading your journal…
        </p>
      ) : null}
      <div className="metric-grid">
        <Metric
          label="Days checked in"
          value={String(checked.length)}
          detail={`${data.sessions.length} sessions recorded`}
        />
        <Metric
          label="Matches logged"
          value={String(data.matches.length)}
          detail="Valve + FACEIT · manual entries"
        />
        <Metric
          label="Win rate"
          value={outcomes ? `${display(winRate(data.matches), 0)}%` : "—"}
          detail={`${outcomes} matches with a result`}
        />
        <Metric
          label="Overall K/D"
          value={display(kd(data.matches), 2)}
          detail="Total kills ÷ total deaths"
        />
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-title">
            <Activity />
            <h2>Performance over time</h2>
            <Link className="text-button push" href="/analytics">
              Explore <ArrowUpRight size={14} style={{ display: "inline" }} />
            </Link>
          </div>
          <div className="chart-key">
            <span>
              <i />
              Average ADR
            </span>
            <span>
              <i className="blue" />
              Self-rating / 10
            </span>
            <small>Last 14 days with logged activity</small>
          </div>
          <PerformanceChart
            rows={rows
              .filter((r) => r.matches.length)
              .slice(-14)
              .map((r) => ({
                date: r.day.date,
                adr: r.adr,
                performance: r.performance,
              }))}
          />
        </section>
        <aside className="panel">
          <div className="panel-title">
            <CalendarCheck />
            <h2>Daily rhythm</h2>
          </div>
          <div className="rhythm">
            <div>
              <span>Average sleep</span>
              <strong>
                {display(average(checked.map((d) => d.sleepHours)))}{" "}
                <small>h</small>
              </strong>
            </div>
            <div>
              <span>Average energy</span>
              <strong>
                {display(average(checked.map((d) => d.energy)))}{" "}
                <small>/10</small>
              </strong>
            </div>
            <div>
              <span>Average focus</span>
              <strong>
                {display(average(checked.map((d) => d.focus)))}{" "}
                <small>/10</small>
              </strong>
            </div>
            <div>
              <span>Average ADR</span>
              <strong>
                {display(average(data.matches.map((m) => m.adr)))}
              </strong>
            </div>
          </div>
          <p className="hint">
            Only recorded values are included. Missing values stay unknown.
          </p>
        </aside>
      </div>
      <section className="panel section-gap">
        <div className="panel-title">
          <Target />
          <h2>Recent matches</h2>
          <Link className="text-button push" href="/matches">
            <Plus size={14} style={{ display: "inline" }} /> Log a match
          </Link>
        </div>
        {!data.matches.length ? (
          <div className="empty">
            <Target />
            <h3>Your first match starts here.</h3>
            <p>Create a session, play a match, then record how it went.</p>
            <Link className="secondary" href="/matches">
              Open match log
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Date",
                  "Map",
                  "Platform",
                  "Result",
                  "Demo K / A / D",
                  "Demo ADR",
                  "Impact",
                ].map((h) => (
                  <TableHead key={h}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.matches.slice(0, 6).map((m) => {
                const report = demoReports.find((item) => item.sourceMatchId === m.id);
                const reportUrl = report ? `/demo-parser/reports/${report.id}` : null;
                return (
                <TableRow
                  key={m.id}
                  className={reportUrl ? "dashboard-match-link" : undefined}
                  role={reportUrl ? "link" : undefined}
                  tabIndex={reportUrl ? 0 : undefined}
                  onClick={() => reportUrl && router.push(reportUrl)}
                  onKeyDown={(event) => {
                    if (reportUrl && (event.key === "Enter" || event.key === " ")) router.push(reportUrl);
                  }}
                >
                  <TableCell>{formatDate(m.playedAt)}</TableCell>
                  <TableCell>{m.map || "Not recorded"}</TableCell>
                  <TableCell>
                    <span className="badge">
                      {m.platform === "VALVE" ? "Valve" : "FACEIT"}
                    </span>
                  </TableCell>
                  <TableCell className={`result-${m.result}`}>
                    {m.result ?? "—"}
                  </TableCell>
                  <TableCell>
                    {report?.metrics?.kills?.value ?? "—"} / {report?.metrics?.assists?.value ?? "—"} / {report?.metrics?.deaths?.value ?? "—"}
                  </TableCell>
                  <TableCell>{display(report?.metrics?.adr?.value)}</TableCell>
                  <TableCell>{report ? `${report.impact.value}${report.impact.incomplete ? "*" : ""}` : "—"}</TableCell>
                </TableRow>
              );})}
            </TableBody>
          </Table>
        )}
      </section>
    </>
  );
}
function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <p className="subtle">{detail}</p>
    </div>
  );
}
