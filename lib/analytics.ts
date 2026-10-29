import { AppData, Match, DailyLog } from "./model";
import type { MetricValue } from "./demo-parser/types";

export type DemoAnalyticsReport = {
  sourceMatchId?: string;
  metrics: {
    kills: MetricValue;
    deaths: MetricValue;
    adr: MetricValue;
  };
};

function reportIndex(reports: DemoAnalyticsReport[]) {
  const index = new Map<string, DemoAnalyticsReport>();
  for (const report of reports) {
    if (report.sourceMatchId && !index.has(report.sourceMatchId))
      index.set(report.sourceMatchId, report);
  }
  return index;
}

function demoKd(reports: DemoAnalyticsReport[]) {
  const paired = reports.filter(
    (report) => report.metrics.kills.value !== null && report.metrics.deaths.value !== null,
  );
  if (!paired.length) return null;
  const deaths = paired.reduce((total, report) => total + report.metrics.deaths.value!, 0);
  return deaths
    ? paired.reduce((total, report) => total + report.metrics.kills.value!, 0) / deaths
    : null;
}
export function average(values: (number | null | undefined)[]) {
  const nums = values.filter(
    (n): n is number => typeof n === "number" && Number.isFinite(n),
  );
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}
export function kd(matches: Match[]) {
  const paired = matches.filter((m) => m.kills !== null && m.deaths !== null);
  if (!paired.length) return null;
  const deaths = paired.reduce((a, m) => a + m.deaths!, 0);
  return deaths ? paired.reduce((a, m) => a + m.kills!, 0) / deaths : null;
}
export function winRate(matches: Match[]) {
  const known = matches.filter((m) => m.result !== null);
  return known.length
    ? (known.filter((m) => m.result === "WIN").length / known.length) * 100
    : null;
}
export function dailyRows(data: AppData, demoReports?: DemoAnalyticsReport[]) {
  const reportsByMatch = demoReports ? reportIndex(demoReports) : null;
  return data.dailyLogs
    .map((day) => {
      const ids = new Set(
        data.sessions.filter((s) => s.dailyLogId === day.id).map((s) => s.id),
      );
      const matches = data.matches.filter((m) => ids.has(m.sessionId));
      const reports = reportsByMatch
        ? matches.flatMap((match) => {
            const report = reportsByMatch.get(match.id);
            return report ? [report] : [];
          })
        : [];
      const measuredMatches = reportsByMatch
        ? matches.filter((match) => reportsByMatch.has(match.id))
        : matches;
      return {
        day,
        matches,
        measuredMatches,
        demoReports: reports,
        adr: reportsByMatch
          ? average(reports.map((report) => report.metrics.adr.value))
          : average(matches.map((m) => m.adr)),
        kd: reportsByMatch ? demoKd(reports) : kd(matches),
        winRate: winRate(matches),
        performance: average(matches.map((m) => m.performance)),
      };
    })
    .sort((a, b) => a.day.date.localeCompare(b.day.date));
}
export function pearson(pairs: [number, number][]) {
  const n = pairs.length;
  if (n < 3) return null;
  const x = average(pairs.map((p) => p[0]))!,
    y = average(pairs.map((p) => p[1]))!;
  let xx = 0,
    yy = 0,
    xy = 0;
  for (const [a, b] of pairs) {
    xx += (a - x) ** 2;
    yy += (b - y) ** 2;
    xy += (a - x) * (b - y);
  }
  return xx === 0 || yy === 0
    ? null
    : Math.max(-1, Math.min(1, xy / Math.sqrt(xx * yy)));
}
export function correlation(data: AppData, field: keyof DailyLog, demoReports?: DemoAnalyticsReport[]) {
  const pairs = dailyRows(data, demoReports)
    .filter(
      (r) =>
        r.day.checkedInAt && typeof r.day[field] === "number" && r.adr !== null,
    )
    .map((r) => [r.day[field] as number, r.adr!] as [number, number]);
  return { pairs, n: pairs.length, r: pearson(pairs) };
}
export function compareHabit(data: AppData, field: keyof DailyLog, demoReports?: DemoAnalyticsReport[]) {
  const rows = dailyRows(data, demoReports).filter((r) => r.day.checkedInAt);
  return [true, false].map((value) => {
    const group = rows.filter((r) => r.day[field] === value);
    const matches = group.flatMap((r) => r.measuredMatches);
    const reports = group.flatMap((r) => r.demoReports);
    return {
      value,
      days: group.length,
      matches: matches.length,
      adr: demoReports
        ? average(reports.map((report) => report.metrics.adr.value))
        : average(matches.map((m) => m.adr)),
      kd: demoReports ? demoKd(reports) : kd(matches),
      winRate: winRate(matches),
    };
  });
}
