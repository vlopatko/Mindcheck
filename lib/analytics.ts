import { AppData, Match, DailyLog } from "./model";
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
export function dailyRows(data: AppData) {
  return data.dailyLogs
    .map((day) => {
      const ids = new Set(
        data.sessions.filter((s) => s.dailyLogId === day.id).map((s) => s.id),
      );
      const matches = data.matches.filter((m) => ids.has(m.sessionId));
      return {
        day,
        matches,
        adr: average(matches.map((m) => m.adr)),
        kd: kd(matches),
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
export function correlation(data: AppData, field: keyof DailyLog) {
  const pairs = dailyRows(data)
    .filter(
      (r) =>
        r.day.checkedInAt && typeof r.day[field] === "number" && r.adr !== null,
    )
    .map((r) => [r.day[field] as number, r.adr!] as [number, number]);
  return { pairs, n: pairs.length, r: pearson(pairs) };
}
export function compareHabit(data: AppData, field: keyof DailyLog) {
  const rows = dailyRows(data).filter((r) => r.day.checkedInAt);
  return [true, false].map((value) => {
    const group = rows.filter((r) => r.day[field] === value);
    const matches = group.flatMap((r) => r.matches);
    return {
      value,
      days: group.length,
      matches: matches.length,
      adr: average(matches.map((m) => m.adr)),
      kd: kd(matches),
      winRate: winRate(matches),
    };
  });
}
