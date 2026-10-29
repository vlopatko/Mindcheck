import type { RawEvent } from "./types";

export function text(event: RawEvent, ...keys: string[]) {
  for (const key of keys) {
    const value = event[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "bigint" || typeof value === "number") return String(value);
  }
  return null;
}

export function numberValue(event: RawEvent, ...keys: string[]) {
  for (const key of keys) {
    const value = event[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

export function boolValue(event: RawEvent, ...keys: string[]) {
  for (const key of keys) {
    const value = event[key];
    if (typeof value === "boolean") return value;
    if (value === 1 || value === "1" || value === "true") return true;
    if (value === 0 || value === "0" || value === "false") return false;
  }
  return null;
}

export function steamId(event: RawEvent, role: "user" | "attacker" | "assister") {
  return text(
    event,
    `${role}_steamid`,
    `${role}_steam_id`,
    ...(role === "user" ? ["steamid", "steam_id"] : []),
  );
}

export function playerName(event: RawEvent, role: "user" | "attacker" | "assister") {
  return text(event, `${role}_name`, ...(role === "user" ? ["name"] : []));
}

export function team(event: RawEvent, role: "user" | "attacker" | "assister" = "user") {
  const raw = text(event, `${role}_team_name`, `${role}_team`, `${role}_team_number`, ...(role === "user" ? ["team_name", "team_number"] : []));
  if (!raw) return null;
  const normalized = raw.toUpperCase();
  if (normalized === "3" || normalized === "CT" || normalized.includes("COUNTER")) return "CT" as const;
  if (normalized === "2" || normalized === "T" || normalized.includes("TERRORIST")) return "T" as const;
  return null;
}

export function tick(event: RawEvent) {
  return numberValue(event, "tick") ?? -1;
}

export function gameTime(event: RawEvent) {
  return numberValue(event, "game_time");
}

export function dedupe(events: RawEvent[], type: string) {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = [
      type,
      tick(event),
      steamId(event, "user"),
      steamId(event, "attacker"),
      steamId(event, "assister"),
      text(event, "weapon"),
      numberValue(event, "dmg_health", "health"),
    ].join(":");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

