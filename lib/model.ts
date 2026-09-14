export const checks = [
  ["sleepOk", "Slept well"],
  ["physicalActivity", "Physical activity"],
  ["discipline", "D1sc1pl1n3"],
  ["ateBeforeSession", "Ate before playing"],
  ["hydrated", "Stayed hydrated"],
  ["nicotine", "Nicotine"],
  ["alcoholYesterday", "Alcohol yesterday"],
  ["warmup", "Warmed up"],
  ["aimTraining", "Aim training"],
  ["dm", "Deathmatch"],
] as const;
export const scales = [
  ["sleepQuality", "Sleep quality"],
  ["energy", "Energy"],
  ["focus", "Focus"],
  ["mood", "Mood"],
  ["stress", "Stress"],
  ["tilt", "Tilt"],
  ["confidence", "Confidence"],
] as const;
export const assessments = [
  ["performance", "My performance"],
  ["aim", "Aim"],
  ["movement", "Movement"],
  ["decisions", "Decisions"],
  ["communication", "Communication"],
  ["focusAfter", "Focus after"],
  ["confidenceAfter", "Confidence after"],
] as const;
export type CheckKey = (typeof checks)[number][0];
export type ScaleKey = (typeof scales)[number][0];
export type AssessmentKey = (typeof assessments)[number][0];
export type DailyInput = Record<CheckKey, boolean | null> &
  Record<ScaleKey, number | null> & {
    date: string;
    sleepHours: number | null;
    warmupMinutes: number | null;
    caffeine: "NONE" | "LOW" | "MEDIUM" | "HIGH" | null;
    notes: string;
  };
export type DailyLog = DailyInput & {
  id: string;
  checkedInAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type Session = {
  id: string;
  dailyLogId: string;
  name: string;
  startedAt: string;
  notes: string | null;
  createdAt: string;
};
export type MatchInput = Record<AssessmentKey, number | null> & {
  sessionId: string;
  playedAt: string;
  platform: "VALVE" | "FACEIT";
  map: string;
  result: "WIN" | "LOSS" | "DRAW" | null;
  teamScore: number | null;
  enemyScore: number | null;
  kills: number | null;
  deaths: number | null;
  assists: number | null;
  adr: number | null;
  headshot: number | null;
  rating: number | null;
  tilted: boolean | null;
  tired: boolean | null;
  notes: string;
};
export type Match = MatchInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  steamMatchId: string | null;
  shareCode: string | null;
  demoUrl: string | null;
};
export type AppData = {
  dailyLogs: DailyLog[];
  sessions: Session[];
  matches: Match[];
};
export const emptyData: AppData = { dailyLogs: [], sessions: [], matches: [] };
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function localDateTime(d = new Date()) {
  return `${localDate(d)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
export function blankDay(date: string): DailyInput {
  return {
    date,
    sleepHours: null,
    warmupMinutes: null,
    caffeine: null,
    notes: "",
    ...Object.fromEntries([...checks, ...scales].map(([key]) => [key, null])),
  } as DailyInput;
}
export function blankMatch(sessionId = ""): MatchInput {
  return {
    sessionId,
    playedAt: new Date().toISOString(),
    platform: "VALVE",
    map: "",
    result: null,
    teamScore: null,
    enemyScore: null,
    kills: null,
    deaths: null,
    assists: null,
    adr: null,
    headshot: null,
    rating: null,
    tilted: null,
    tired: null,
    notes: "",
    ...Object.fromEntries(assessments.map(([key]) => [key, null])),
  } as MatchInput;
}
export function dayInput(day: DailyLog): DailyInput {
  const { id, createdAt, updatedAt, checkedInAt, ...input } = day;
  void id;
  void createdAt;
  void updatedAt;
  void checkedInAt;
  return { ...input, notes: input.notes ?? "" };
}
export function matchInput(match: Match): MatchInput {
  const {
    id,
    createdAt,
    updatedAt,
    steamMatchId,
    shareCode,
    demoUrl,
    ...input
  } = match;
  void id;
  void createdAt;
  void updatedAt;
  void steamMatchId;
  void shareCode;
  void demoUrl;
  return { ...input, map: input.map ?? "", notes: input.notes ?? "" };
}
export function hasCheckin(day: DailyInput) {
  return Object.entries(day).some(
    ([key, value]) => key !== "date" && value !== null && value !== "",
  );
}
export const display = (n: number | null | undefined, digits = 1) =>
  n == null ? "—" : n.toFixed(digits);
export const formatDate = (s: string) =>
  new Date(s.slice(0, 10) + "T12:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
