const DEFAULT_TIME_ZONE = "Europe/Kyiv";

function parts(date: Date) {
  const values = new Intl.DateTimeFormat("en-US", {
    timeZone: process.env.APP_TIME_ZONE ?? DEFAULT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(values.map((part) => [part.type, part.value]));
}

export function sessionDateKey(startedAt: Date) {
  const value = parts(startedAt);
  return `${value.year}-${value.month}-${value.day}`;
}

export function sessionPeriod(startedAt: Date) {
  const hour = Number(parts(startedAt).hour);
  return hour >= 6 && hour < 18 ? "day" : "night";
}

export function automaticSessionName(startedAt: Date, sessionNumber: number) {
  const [year, month, day] = sessionDateKey(startedAt).split("-");
  return `${day}-${month}-${year}_${sessionPeriod(startedAt)}_${sessionNumber}`;
}

export const SESSION_GAP_MS = 3 * 3_600_000;
