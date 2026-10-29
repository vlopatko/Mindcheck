export type MetricStatus = "measured" | "inferred" | "unavailable";

export type MetricValue = {
  value: number | null;
  status: MetricStatus;
  note?: string;
};

export type DemoPlayer = {
  steamId64: string;
  name: string;
};

export type TimelineEntry = {
  tick: number;
  seconds: number | null;
  type: string;
  label: string;
  status: MetricStatus;
  context?: string;
};

export type ImpactComponent = {
  key: "combat" | "support" | "objective" | "risk" | "clutch";
  label: string;
  points: number;
  detail: string;
};

export type ImpactScore = {
  value: number;
  incomplete: boolean;
  formulaVersion: string;
  components: ImpactComponent[];
};

export type RoundReport = {
  number: number;
  startTick: number;
  activeTick: number;
  endTick: number;
  side: "T" | "CT" | null;
  winner: "T" | "CT" | null;
  won: boolean | null;
  endReason: string | null;
  participated: boolean;
  kills: number;
  deaths: number;
  assists: number;
  enemyDamage: number;
  grenadeDamage: number;
  teamDamage: number;
  teamKills: number;
  enemyFlashes: number | null;
  teamFlashes: number | null;
  flashAssists: number | null;
  firstKill: boolean;
  firstDeath: boolean;
  tradeKills: number;
  tradedDeaths: number;
  plants: number;
  defuses: number;
  clutchWon: number | null;
  clutchVs: number | null;
  timeline: TimelineEntry[];
  impact: ImpactScore;
};

export type MatchMetrics = {
  kills: MetricValue;
  deaths: MetricValue;
  assists: MetricValue;
  kd: MetricValue;
  enemyDamage: MetricValue;
  adr: MetricValue;
  grenadeDamage: MetricValue;
  firstKills: MetricValue;
  firstDeaths: MetricValue;
  tradeKills: MetricValue;
  tradedDeaths: MetricValue;
  multiKillRounds: MetricValue;
  clutches: MetricValue;
  plants: MetricValue;
  defuses: MetricValue;
  enemyFlashes: MetricValue;
  flashAssists: MetricValue;
  teamDamage: MetricValue;
  teamKills: MetricValue;
  teamFlashes: MetricValue;
};

export type SideSummary = {
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  impact: number | null;
};

export type DemoReport = {
  schemaVersion: "1.0";
  id: string;
  createdAt: string;
  source: "upload" | "steam";
  sourceMatchId?: string;
  parser: { package: "@laihoe/demoparser2"; version: "0.42.0" };
  map: string | null;
  player: DemoPlayer;
  players: DemoPlayer[];
  score: { team: number; enemy: number } | null;
  roundsPlayed: number;
  metrics: MatchMetrics;
  sides: { T: SideSummary; CT: SideSummary };
  impact: ImpactScore;
  formulaConfig: Record<string, unknown>;
  rounds: RoundReport[];
  availability: Record<string, { status: MetricStatus; reason?: string }>;
  warnings: string[];
  definitions: Record<string, string>;
};

export type RawEvent = Record<string, unknown>;
