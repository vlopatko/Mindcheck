import {
  listGameEvents,
  parseEvent,
  parseHeader,
  parsePlayerInfo,
  parseTicks,
} from "@laihoe/demoparser2";
import { createHash } from "node:crypto";
import { calculateReport } from "./report";
import { boolValue, dedupe, numberValue, text, tick } from "./normalize";
import type { DemoPlayer, DemoReport, RawEvent } from "./types";

const eventNames = [
  "round_start",
  "round_freeze_end",
  "round_end",
  "round_officially_ended",
  "player_death",
  "player_hurt",
  "player_blind",
  "bomb_planted",
  "bomb_defused",
] as const;

const playerProps = ["team_name"];
const gameProps = ["total_rounds_played", "is_warmup_period", "game_time"];

type ParsedDemo = {
  header: RawEvent;
  players: DemoPlayer[];
  events: Record<(typeof eventNames)[number], RawEvent[]>;
  ticks: RawEvent[];
  availability: Record<string, boolean>;
};

function records(value: unknown): RawEvent[] {
  return Array.isArray(value)
    ? value.filter((item): item is RawEvent => Boolean(item) && typeof item === "object")
    : [];
}

function availableEvents(value: unknown) {
  const result = new Set<string>();
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") result.add(item);
      else if (item && typeof item === "object") {
        const name = text(item as RawEvent, "name", "event_name");
        if (name) result.add(name);
      }
    }
  }
  return result;
}

export function inspectDemo(buffer: Buffer) {
  const header = (parseHeader(buffer) ?? {}) as RawEvent;
  const players = records(parsePlayerInfo(buffer))
    .map((player) => ({
      steamId64: text(player, "steamid", "steam_id") ?? "",
      name: text(player, "name") ?? "Unknown player",
    }))
    .filter((player) => /^\d{16,20}$/.test(player.steamId64));
  return {
    map: text(header, "map_name"),
    players: [...new Map(players.map((player) => [player.steamId64, player])).values()],
  };
}

function parseDemo(buffer: Buffer): ParsedDemo {
  const header = (parseHeader(buffer) ?? {}) as RawEvent;
  const players = inspectDemo(buffer).players;
  const listed = availableEvents(listGameEvents(buffer));
  const availability: Record<string, boolean> = {};
  const parseErrors: string[] = [];
  const eventEntries = eventNames.map((name) => {
    try {
      // listGameEvents is diagnostic only. Some demo/parser combinations omit
      // names from its census even though querying that event returns rows.
      const rows = dedupe(records(parseEvent(buffer, name, playerProps, gameProps)), name)
        .sort((a, b) => tick(a) - tick(b));
      availability[name] = listed.has(name) || rows.length > 0;
      return [name, rows] as const;
    } catch (error) {
      availability[name] = false;
      parseErrors.push(`${name}: ${error instanceof Error ? error.message : "unknown parser error"}`);
      return [name, []] as const;
    }
  });
  const events = Object.fromEntries(eventEntries) as ParsedDemo["events"];
  if (!events.round_end.length && !events.round_start.length && !events.player_death.length && parseErrors.length)
    throw new Error(`Core demo events could not be parsed. ${parseErrors.slice(0, 3).join("; ")}`);

  const sampleTicks = [...new Set([
    ...events.round_freeze_end.map(tick),
    ...events.round_start.map(tick),
    ...events.player_death.map(tick),
  ].filter((value) => value >= 0))].sort((a, b) => a - b);
  let ticks: RawEvent[] = [];
  if (sampleTicks.length) {
    try {
      ticks = records(parseTicks(buffer, ["team_name", "is_alive", "health"], sampleTicks));
    } catch {
      ticks = [];
    }
  }
  return { header, players, events, ticks, availability };
}

export function analyzeDemo(
  buffer: Buffer,
  selectedSteamId: string,
  source: "upload" | "steam" = "upload",
  sourceMatchId?: string,
): DemoReport {
  const parsed = parseDemo(buffer);
  const selected = parsed.players.find((player) => player.steamId64 === selectedSteamId);
  if (!selected) throw new Error(`SteamID64 ${selectedSteamId} is not present in this demo.`);
  const report = calculateReport(parsed, selected, source, sourceMatchId);
  report.id = createHash("sha256")
    .update(buffer.subarray(0, Math.min(buffer.length, 1_000_000)))
    .update(selectedSteamId)
    .digest("hex")
    .slice(0, 20);
  return report;
}

export function demoLooksLikeWarmup(event: RawEvent) {
  return boolValue(event, "is_warmup_period") === true || numberValue(event, "total_rounds_played") === -1;
}
