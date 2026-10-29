import { impactConfig, IMPACT_FORMULA_VERSION, metricDefinitions } from "./config";
import { boolValue, gameTime, numberValue, playerName, steamId, team, text, tick } from "./normalize";
import type {
  DemoPlayer,
  DemoReport,
  ImpactComponent,
  ImpactScore,
  MatchMetrics,
  MetricStatus,
  MetricValue,
  RawEvent,
  RoundReport,
  SideSummary,
  TimelineEntry,
} from "./types";

type ParsedInput = {
  header: RawEvent;
  players: DemoPlayer[];
  events: Record<string, RawEvent[]>;
  ticks: RawEvent[];
  availability: Record<string, boolean>;
};

type RoundWork = RoundReport & {
  activeGameTime: number | null;
  activeBoundaryInferred: boolean;
};

const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function metric(value: number | null, status: MetricStatus, note?: string): MetricValue {
  return { value, status, ...(note ? { note } : {}) };
}

function isWarmup(event: RawEvent) {
  return boolValue(event, "is_warmup_period") === true;
}

function eventSeconds(event: RawEvent, round: RoundWork) {
  const current = gameTime(event);
  return current == null || round.activeGameTime == null ? null : Math.max(0, current - round.activeGameTime);
}

function timeline(event: RawEvent, round: RoundWork, type: string, label: string, status: MetricStatus, context?: string): TimelineEntry {
  return { tick: tick(event), seconds: eventSeconds(event, round), type, label, status, ...(context ? { context } : {}) };
}

function inRound(events: RawEvent[], round: RoundWork) {
  return events.filter((event) => tick(event) >= round.activeTick && tick(event) <= round.endTick);
}

function isEnemyAction(event: RawEvent) {
  const actor = team(event, "attacker");
  const victim = team(event, "user");
  return Boolean(actor && victim && actor !== victim);
}

function buildRounds(input: ParsedInput, selectedSteamId: string) {
  const starts = input.events.round_start.filter((event) => !isWarmup(event));
  const activeStarts = input.events.round_freeze_end.filter((event) => !isWarmup(event));
  const ends = input.events.round_end.filter((event) => !isWarmup(event));
  const rounds: RoundWork[] = [];
  const flashAttributionAvailable = input.availability.player_blind &&
    (input.events.player_blind.length === 0 || input.events.player_blind.every((event) => Boolean(steamId(event, "attacker"))));
  const aliveSnapshotsAvailable = input.ticks.length > 0 && input.ticks.some((row) => boolValue(row, "is_alive") != null && team(row) != null);
  let previousEnd = -1;

  for (const end of ends) {
    const candidates = activeStarts.filter((event) => tick(event) > previousEnd && tick(event) < tick(end));
    const fallbackStarts = starts.filter((event) => tick(event) > previousEnd && tick(event) < tick(end));
    const active = candidates.at(-1) ?? fallbackStarts.at(-1);
    if (!active) continue;
    const start = starts.filter((event) => tick(event) > previousEnd && tick(event) <= tick(active)).at(-1) ?? active;
    const snapshot = input.ticks.find((row) => tick(row) === tick(active) && text(row, "steamid", "steam_id") === selectedSteamId);
    const side = snapshot ? team(snapshot) : null;
    const rawWinner = text(end, "winner");
    const winner = rawWinner ? (rawWinner.toUpperCase().includes("CT") || rawWinner === "3" ? "CT" : rawWinner.toUpperCase().includes("T") || rawWinner === "2" ? "T" : null) : null;
    rounds.push({
      number: rounds.length + 1,
      startTick: tick(start),
      activeTick: tick(active),
      endTick: tick(end),
      activeGameTime: gameTime(active),
      activeBoundaryInferred: candidates.length === 0,
      side,
      winner,
      won: side && winner ? side === winner : null,
      endReason: text(end, "reason", "message", "legacy"),
      participated: Boolean(snapshot),
      kills: 0,
      deaths: 0,
      assists: 0,
      enemyDamage: 0,
      grenadeDamage: 0,
      teamDamage: 0,
      teamKills: 0,
      enemyFlashes: flashAttributionAvailable ? 0 : null,
      teamFlashes: flashAttributionAvailable ? 0 : null,
      flashAssists: input.availability.player_death ? 0 : null,
      firstKill: false,
      firstDeath: false,
      tradeKills: 0,
      tradedDeaths: 0,
      plants: 0,
      defuses: 0,
      clutchWon: aliveSnapshotsAvailable ? 0 : null,
      clutchVs: aliveSnapshotsAvailable ? 0 : null,
      timeline: [],
      impact: { value: impactConfig.baseline, incomplete: false, formulaVersion: IMPACT_FORMULA_VERSION, components: [] },
    });
    previousEnd = tick(end);
  }
  return rounds;
}

function damageAmount(event: RawEvent) {
  const dealt = numberValue(event, "dmg_health");
  const remaining = numberValue(event, "health");
  if (dealt == null) return null;
  return remaining == null ? Math.max(0, dealt) : Math.max(0, Math.min(dealt, remaining + dealt));
}

function isGrenadeWeapon(value: string | null) {
  return Boolean(value && /grenade|hegrenade|inferno|molotov|incgrenade/i.test(value));
}

function impactFor(round: RoundReport, incomplete: boolean): ImpactScore {
  const combat = clamp(
    Math.min(round.enemyDamage / impactConfig.combat.damagePerPoint, impactConfig.combat.damageCap) +
      Math.min(round.kills * impactConfig.combat.killPoints, impactConfig.combat.killCap) +
      (round.firstKill ? impactConfig.combat.firstKill : 0) +
      round.tradeKills * impactConfig.combat.tradeKill,
    0,
    impactConfig.combat.totalCap,
  );
  const flashExtra = round.flashAssists ?? 0;
  const support = clamp(
    round.assists * impactConfig.support.assist + flashExtra * impactConfig.support.flashAssistExtra,
    0,
    impactConfig.support.totalCap,
  );
  const objective = clamp(
    round.plants * impactConfig.objective.plant + round.defuses * impactConfig.objective.defuse,
    0,
    impactConfig.objective.totalCap,
  );
  const useful = round.enemyDamage > 0 || round.kills > 0 || round.assists > 0 || round.plants > 0 || round.defuses > 0;
  const risk = clamp(
    (round.firstDeath ? impactConfig.risk.firstDeath : 0) +
      (round.deaths > 0 && !useful ? impactConfig.risk.emptyDeath : 0) +
      Math.max(round.teamDamage * impactConfig.risk.teamDamagePerPoint, impactConfig.risk.teamDamageFloor) +
      round.teamKills * impactConfig.risk.teamKill +
      Math.max((round.teamFlashes ?? 0) * impactConfig.risk.teamFlash, impactConfig.risk.teamFlashFloor),
    impactConfig.risk.totalFloor,
    0,
  );
  const clutch = round.clutchWon
    ? Math.min(impactConfig.clutch.base + Math.max(0, (round.clutchVs ?? 1) - 1) * impactConfig.clutch.perExtraOpponent, impactConfig.clutch.cap)
    : 0;
  const components: ImpactComponent[] = [
    { key: "combat", label: "Combat", points: combat, detail: `${round.enemyDamage} damage, ${round.kills} kills, ${round.firstKill ? "opening kill" : "no opening kill"}, ${round.tradeKills} trades` },
    { key: "support", label: "Support", points: support, detail: `${round.assists} assists, ${round.flashAssists ?? "unknown"} confirmed flash assists; grenade damage is already inside combat damage` },
    { key: "objective", label: "Objective", points: objective, detail: `${round.plants} plants, ${round.defuses} defuses` },
    { key: "risk", label: "Risk / errors", points: risk, detail: `${round.firstDeath ? "first death; " : ""}${round.teamDamage} team damage, ${round.teamKills} team kills` },
    { key: "clutch", label: "Clutch", points: clutch, detail: round.clutchWon ? `confirmed 1v${round.clutchVs}` : "no confirmed clutch" },
  ];
  return {
    value: Math.round(clamp(impactConfig.baseline + sum(components.map((component) => component.points)), 0, 100) * 10) / 10,
    incomplete,
    formulaVersion: IMPACT_FORMULA_VERSION,
    components,
  };
}

function sideSummary(rounds: RoundReport[], side: "T" | "CT"): SideSummary {
  const selected = rounds.filter((round) => round.participated && round.side === side);
  return {
    rounds: selected.length,
    kills: sum(selected.map((round) => round.kills)),
    deaths: sum(selected.map((round) => round.deaths)),
    assists: sum(selected.map((round) => round.assists)),
    damage: sum(selected.map((round) => round.enemyDamage)),
    impact: selected.length ? Math.round((sum(selected.map((round) => round.impact.value)) / selected.length) * 10) / 10 : null,
  };
}

export function calculateReport(
  input: ParsedInput,
  selected: DemoPlayer,
  source: "upload" | "steam",
  sourceMatchId?: string,
): DemoReport {
  const rounds = buildRounds(input, selected.steamId64);
  const warnings: string[] = [];
  const deathAvailable = input.availability.player_death &&
    (input.events.player_death.length === 0 || input.events.player_death.some((event) => Boolean(steamId(event, "user"))));
  const damageAvailable = input.availability.player_hurt &&
    (input.events.player_hurt.length === 0 || input.events.player_hurt.some((event) => numberValue(event, "dmg_health") != null));
  const flashAvailable = input.availability.player_blind &&
    (input.events.player_blind.length === 0 || input.events.player_blind.every((event) => Boolean(steamId(event, "attacker"))));
  const tradeAvailable = deathAvailable &&
    (input.events.player_death.length === 0 || input.events.player_death.some((event) => gameTime(event) != null));
  const clutchAvailable = input.ticks.length > 0 && input.ticks.some((row) => boolValue(row, "is_alive") != null && team(row) != null);
  const roundBoundariesAvailable = input.availability.round_end &&
    (input.availability.round_freeze_end || input.availability.round_start);
  const roundTimingPrecise = input.availability.round_end && input.availability.round_freeze_end;
  if (!roundBoundariesAvailable)
    warnings.push("Confirmed round start/end boundaries are missing; incomplete rounds are excluded.");
  else if (!roundTimingPrecise)
    warnings.push("round_freeze_end is absent; round_start is used as the action boundary and displayed time can include freeze time.");
  if (!damageAvailable) warnings.push("player_hurt is absent, so damage metrics are unavailable.");
  if (!flashAvailable) warnings.push("player_blind is absent, so flash effectiveness is unavailable.");
  if (!tradeAvailable) warnings.push("Death timing is absent, so trade metrics are unavailable.");
  if (!clutchAvailable) warnings.push("Alive-player snapshots could not be reconstructed; clutch metrics are unavailable.");

  for (const round of rounds) {
    const deaths = inRound(input.events.player_death, round).filter((event) => tick(event) <= round.endTick);
    const validEnemyDeaths = deaths.filter((event) => {
      const attacker = steamId(event, "attacker");
      const victim = steamId(event, "user");
      return attacker && victim && attacker !== victim && isEnemyAction(event);
    });
    const first = validEnemyDeaths[0];
    if (first) {
      round.firstKill = steamId(first, "attacker") === selected.steamId64;
      round.firstDeath = steamId(first, "user") === selected.steamId64;
      if (round.firstKill) round.timeline.push(timeline(first, round, "first-kill", "First enemy kill of the round", "inferred"));
      if (round.firstDeath) round.timeline.push(timeline(first, round, "first-death", "First enemy death of the round", "inferred"));
    }

    for (const death of deaths) {
      const attacker = steamId(death, "attacker");
      const victim = steamId(death, "user");
      const victimName = playerName(death, "user") ?? victim ?? "player";
      if (attacker === selected.steamId64 && victim !== selected.steamId64) {
        if (isEnemyAction(death)) {
          round.kills++;
          round.timeline.push(timeline(death, round, "kill", `Killed ${victimName}`, "measured", text(death, "weapon") ?? undefined));
        } else if (team(death, "attacker") && team(death, "attacker") === team(death, "user")) {
          round.teamKills++;
          round.timeline.push(timeline(death, round, "team-kill", `Killed teammate ${victimName}`, "measured"));
        }
      }
      if (victim === selected.steamId64) {
        round.deaths++;
        round.timeline.push(timeline(death, round, "death", `Died to ${playerName(death, "attacker") ?? attacker ?? "world"}`, "measured"));
      }
      if (steamId(death, "assister") === selected.steamId64 && attacker !== selected.steamId64 && isEnemyAction(death)) {
        round.assists++;
        const flashed = boolValue(death, "assistedflash", "assisted_flash") === true;
        if (flashed && round.flashAssists != null) round.flashAssists++;
        round.timeline.push(timeline(death, round, flashed ? "flash-assist" : "assist", flashed ? `Confirmed flash assist on ${victimName}` : `Assisted on ${victimName}`, "measured"));
      }
    }

    for (const hurt of inRound(input.events.player_hurt, round)) {
      if (steamId(hurt, "attacker") !== selected.steamId64 || steamId(hurt, "user") === selected.steamId64) continue;
      const amount = damageAmount(hurt);
      if (amount == null) continue;
      const weapon = text(hurt, "weapon");
      if (isEnemyAction(hurt)) {
        round.enemyDamage += amount;
        if (isGrenadeWeapon(weapon)) round.grenadeDamage += amount;
        round.timeline.push(timeline(hurt, round, isGrenadeWeapon(weapon) ? "grenade-damage" : "damage", `${amount} damage to ${playerName(hurt, "user") ?? "enemy"}`, "measured", weapon ?? undefined));
      } else if (team(hurt, "attacker") && team(hurt, "attacker") === team(hurt, "user")) {
        round.teamDamage += amount;
        round.timeline.push(timeline(hurt, round, "team-damage", `${amount} team damage to ${playerName(hurt, "user") ?? "teammate"}`, "measured", weapon ?? undefined));
      }
    }

    for (const blind of inRound(input.events.player_blind, round)) {
      if (steamId(blind, "attacker") !== selected.steamId64) continue;
      const duration = numberValue(blind, "blind_duration");
      if (duration != null && duration <= 0) continue;
      if (team(blind, "attacker") && team(blind, "attacker") === team(blind, "user")) {
        if (round.teamFlashes != null) round.teamFlashes++;
        round.timeline.push(timeline(blind, round, "team-flash", `Flashed teammate ${playerName(blind, "user") ?? "player"}`, "measured", duration == null ? undefined : `${duration.toFixed(1)}s`));
      } else if (isEnemyAction(blind)) {
        if (round.enemyFlashes != null) round.enemyFlashes++;
        round.timeline.push(timeline(blind, round, "enemy-flash", `Flashed enemy ${playerName(blind, "user") ?? "player"}`, "measured", duration == null ? undefined : `${duration.toFixed(1)}s`));
      }
    }

    for (const planted of inRound(input.events.bomb_planted, round)) {
      if (steamId(planted, "user") === selected.steamId64) {
        round.plants++;
        round.timeline.push(timeline(planted, round, "plant", "Planted the bomb", "measured", text(planted, "site") ?? undefined));
      }
    }
    for (const defused of inRound(input.events.bomb_defused, round)) {
      if (steamId(defused, "user") === selected.steamId64) {
        round.defuses++;
        round.timeline.push(timeline(defused, round, "defuse", "Defused the bomb", "measured", text(defused, "site") ?? undefined));
      }
    }

    for (const kill of validEnemyDeaths.filter((event) => steamId(event, "attacker") === selected.steamId64)) {
      const victim = steamId(kill, "user");
      const traded = validEnemyDeaths.find((prior) =>
        tick(prior) < tick(kill) &&
        tick(kill) - tick(prior) >= 0 &&
        steamId(prior, "attacker") === victim &&
        team(prior, "user") === team(kill, "attacker") &&
        gameTime(kill) != null && gameTime(prior) != null &&
        gameTime(kill)! - gameTime(prior)! <= impactConfig.tradeWindowSeconds,
      );
      if (traded) {
        round.tradeKills++;
        round.timeline.push(timeline(kill, round, "trade", `Trade kill within ${impactConfig.tradeWindowSeconds}s`, "inferred", `Avenged ${playerName(traded, "user") ?? "teammate"}`));
      }
    }
    const ownDeath = validEnemyDeaths.find((event) => steamId(event, "user") === selected.steamId64);
    if (ownDeath) {
      const killer = steamId(ownDeath, "attacker");
      const traded = validEnemyDeaths.find((later) =>
        tick(later) > tick(ownDeath) &&
        steamId(later, "user") === killer &&
        team(later, "attacker") === team(ownDeath, "user") &&
        gameTime(later) != null && gameTime(ownDeath) != null &&
        gameTime(later)! - gameTime(ownDeath)! <= impactConfig.tradeWindowSeconds,
      );
      if (traded) {
        round.tradedDeaths = 1;
        round.timeline.push(timeline(traded, round, "traded-death", `Death traded within ${impactConfig.tradeWindowSeconds}s`, "inferred"));
      }
    }

    if (round.clutchWon != null && round.side && round.won) {
      for (const death of deaths) {
        const snapshot = input.ticks.filter((row) => tick(row) === tick(death));
        const me = snapshot.find((row) => text(row, "steamid", "steam_id") === selected.steamId64);
        if (!me || boolValue(me, "is_alive") !== true) continue;
        const ownAlive = snapshot.filter((row) => team(row) === round.side && boolValue(row, "is_alive") === true).length;
        const enemyAlive = snapshot.filter((row) => team(row) && team(row) !== round.side && boolValue(row, "is_alive") === true).length;
        if (ownAlive === 1 && enemyAlive >= 1) round.clutchVs = Math.max(round.clutchVs ?? 0, enemyAlive);
      }
      if ((round.clutchVs ?? 0) >= 1) {
        round.clutchWon = 1;
        round.timeline.push({ tick: round.endTick, seconds: null, type: "clutch", label: `Won confirmed 1v${round.clutchVs}`, status: "inferred" });
      }
    }
    round.timeline.sort((a, b) => a.tick - b.tick);
    round.impact = impactFor(round, !damageAvailable || !deathAvailable || !flashAvailable || !tradeAvailable || round.clutchWon == null || round.activeBoundaryInferred);
  }

  const participated = rounds.filter((round) => round.participated);
  const total = (selector: (round: RoundReport) => number) => sum(participated.map(selector));
  const kills = total((round) => round.kills);
  const deaths = total((round) => round.deaths);
  const assists = total((round) => round.assists);
  const damage = total((round) => round.enemyDamage);
  const measured: MetricStatus = "measured";
  const inferred: MetricStatus = "inferred";
  const unavailable = (note: string) => metric(null, "unavailable", note);
  const hasRoundData = participated.length > 0;
  const noRoundData = "No confirmed participated rounds could be reconstructed";
  const metrics: MatchMetrics = {
    kills: deathAvailable && hasRoundData ? metric(kills, measured) : unavailable(deathAvailable ? noRoundData : "player_death is absent"),
    deaths: deathAvailable && hasRoundData ? metric(deaths, measured) : unavailable(deathAvailable ? noRoundData : "player_death is absent"),
    assists: deathAvailable && hasRoundData ? metric(assists, measured) : unavailable(deathAvailable ? noRoundData : "player_death is absent"),
    kd: deathAvailable && hasRoundData ? metric(deaths ? Math.round((kills / deaths) * 100) / 100 : kills, inferred, deaths ? undefined : "No deaths; displayed as kills rather than infinity.") : unavailable(deathAvailable ? noRoundData : "player_death is absent"),
    enemyDamage: damageAvailable && hasRoundData ? metric(damage, measured) : unavailable(damageAvailable ? noRoundData : "player_hurt is absent"),
    adr: damageAvailable && participated.length ? metric(Math.round((damage / participated.length) * 10) / 10, inferred) : unavailable("Damage or participated rounds are unavailable"),
    grenadeDamage: damageAvailable && hasRoundData ? metric(total((round) => round.grenadeDamage), measured) : unavailable(damageAvailable ? noRoundData : "player_hurt is absent"),
    firstKills: deathAvailable && hasRoundData ? metric(total((round) => Number(round.firstKill)), inferred) : unavailable(deathAvailable ? noRoundData : "player_death is absent"),
    firstDeaths: deathAvailable && hasRoundData ? metric(total((round) => Number(round.firstDeath)), inferred) : unavailable(deathAvailable ? noRoundData : "player_death is absent"),
    tradeKills: tradeAvailable && hasRoundData ? metric(total((round) => round.tradeKills), inferred, `${impactConfig.tradeWindowSeconds}s window`) : unavailable(tradeAvailable ? noRoundData : "Death timing is absent"),
    tradedDeaths: tradeAvailable && hasRoundData ? metric(total((round) => round.tradedDeaths), inferred, `${impactConfig.tradeWindowSeconds}s window`) : unavailable(tradeAvailable ? noRoundData : "Death timing is absent"),
    multiKillRounds: deathAvailable && hasRoundData ? metric(participated.filter((round) => round.kills >= 2).length, inferred) : unavailable(deathAvailable ? noRoundData : "player_death is absent"),
    clutches: clutchAvailable && hasRoundData ? metric(total((round) => round.clutchWon ?? 0), inferred) : unavailable(clutchAvailable ? noRoundData : "Alive-player snapshots are unavailable"),
    plants: input.availability.bomb_planted && hasRoundData ? metric(total((round) => round.plants), measured) : unavailable(input.availability.bomb_planted ? noRoundData : "bomb_planted is absent"),
    defuses: input.availability.bomb_defused && hasRoundData ? metric(total((round) => round.defuses), measured) : unavailable(input.availability.bomb_defused ? noRoundData : "bomb_defused is absent"),
    enemyFlashes: flashAvailable && hasRoundData ? metric(total((round) => round.enemyFlashes ?? 0), measured) : unavailable(flashAvailable ? noRoundData : "player_blind is absent"),
    flashAssists: deathAvailable && hasRoundData ? metric(total((round) => round.flashAssists ?? 0), measured) : unavailable(deathAvailable ? noRoundData : "player_death is absent"),
    teamDamage: damageAvailable && hasRoundData ? metric(total((round) => round.teamDamage), measured) : unavailable(damageAvailable ? noRoundData : "player_hurt is absent"),
    teamKills: deathAvailable && hasRoundData ? metric(total((round) => round.teamKills), measured) : unavailable(deathAvailable ? noRoundData : "player_death is absent"),
    teamFlashes: flashAvailable && hasRoundData ? metric(total((round) => round.teamFlashes ?? 0), measured) : unavailable(flashAvailable ? noRoundData : "player_blind is absent"),
  };
  const averageImpact = participated.length ? sum(participated.map((round) => round.impact.value)) / participated.length : impactConfig.baseline;
  const impact: ImpactScore = {
    value: Math.round(averageImpact * 10) / 10,
    incomplete: participated.length === 0 || participated.some((round) => round.impact.incomplete),
    formulaVersion: IMPACT_FORMULA_VERSION,
    components: (["combat", "support", "objective", "risk", "clutch"] as const).map((key) => {
      const items = participated.map((round) => round.impact.components.find((component) => component.key === key)!).filter(Boolean);
      return { key, label: items[0]?.label ?? key, points: participated.length ? Math.round((sum(items.map((item) => item.points)) / participated.length) * 10) / 10 : 0, detail: "Average contribution per participated round" };
    }),
  };
  const teamWins = participated.filter((round) => round.won === true).length;
  const enemyWins = participated.filter((round) => round.won === false).length;
  const availability = {
    rounds: roundTimingPrecise
      ? { status: measured }
      : roundBoundariesAvailable
        ? { status: inferred, reason: "round_start fallback; freeze-end timing is absent" }
        : { status: "unavailable" as const, reason: "Missing round boundaries" },
    combat: { status: deathAvailable && damageAvailable ? measured : "unavailable" as const, ...(!(deathAvailable && damageAvailable) ? { reason: "Missing combat events" } : {}) },
    flashes: { status: flashAvailable ? measured : "unavailable" as const, ...(!flashAvailable ? { reason: "player_blind is absent" } : {}) },
    trades: { status: tradeAvailable ? inferred : "unavailable" as const, ...(!tradeAvailable ? { reason: "Death timing is absent" } : {}) },
    clutches: { status: clutchAvailable ? inferred : "unavailable" as const, ...(!clutchAvailable ? { reason: "Alive snapshots are absent" } : {}) },
  };
  return {
    schemaVersion: "1.0",
    id: "pending",
    createdAt: new Date().toISOString(),
    source,
    ...(sourceMatchId ? { sourceMatchId } : {}),
    parser: { package: "@laihoe/demoparser2", version: "0.42.0" },
    map: text(input.header, "map_name"),
    player: selected,
    players: input.players,
    score: participated.length ? { team: teamWins, enemy: enemyWins } : null,
    roundsPlayed: participated.length,
    metrics,
    sides: { T: sideSummary(participated, "T"), CT: sideSummary(participated, "CT") },
    impact,
    formulaConfig: impactConfig as unknown as Record<string, unknown>,
    rounds,
    availability,
    warnings,
    definitions: metricDefinitions,
  };
}
