"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, FileSearch, History, Trash2, Upload } from "lucide-react";
import type { DemoPlayer, DemoReport, MetricValue, RoundReport } from "@/lib/demo-parser/types";

type Profile = { authenticated: boolean; steamId?: string; displayName?: string };
type SavedReport = Pick<DemoReport, "id" | "createdAt" | "map" | "score" | "impact" | "source" | "sourceMatchId"> & {
  playedAt?: string | null;
};

async function jsonResponse<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.text();
  if (!payload) {
    const suffix = response.status ? ` (HTTP ${response.status})` : "";
    throw new Error(`${fallback}: the server returned an empty response${suffix}.`);
  }
  try {
    return JSON.parse(payload) as T;
  } catch {
    throw new Error(`${fallback}: the server returned an invalid response (HTTP ${response.status}).`);
  }
}

const metricLabels: Record<string, string> = {
  kills: "Kills", deaths: "Deaths", assists: "Assists", kd: "K/D", enemyDamage: "Enemy damage",
  adr: "Damage / round", grenadeDamage: "Grenade damage", firstKills: "First kills", firstDeaths: "First deaths",
  tradeKills: "Trade kills", tradedDeaths: "Deaths traded", multiKillRounds: "Multi-kill rounds", clutches: "Clutches",
  plants: "Plants", defuses: "Defuses", enemyFlashes: "Enemy flashes", flashAssists: "Flash assists",
  teamDamage: "Team damage", teamKills: "Team kills", teamFlashes: "Team flashes",
};

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvCell(value: unknown) {
  const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function reportCsv(report: DemoReport) {
  const rows: unknown[][] = [
    ["record_type", "key", "value", "status", "note", "formula_version", "round", "side", "won", "tick", "seconds", "context"],
    ["match", "map", report.map, "measured", "", report.impact.formulaVersion],
    ["match", "steamId64", report.player.steamId64, "measured", "", report.impact.formulaVersion],
    ["match", "impact", report.impact.value, report.impact.incomplete ? "incomplete" : "inferred", "Mindcheck heuristic", report.impact.formulaVersion],
    ["formula", "config", report.formulaConfig, "", "", report.impact.formulaVersion],
    ...Object.entries(report.metrics).map(([key, item]) => ["metric", key, item.value, item.status, item.note ?? "", report.impact.formulaVersion]),
    ...Object.entries(report.definitions).map(([key, value]) => ["definition", key, value, "", "", report.impact.formulaVersion]),
    ...Object.entries(report.availability).map(([key, value]) => ["availability", key, "", value.status, value.reason ?? "", report.impact.formulaVersion]),
    ...report.rounds.flatMap((round) => [
      ["round", "impact", round.impact.value, round.impact.incomplete ? "incomplete" : "inferred", JSON.stringify(round.impact.components), round.impact.formulaVersion, round.number, round.side, round.won],
      ...round.timeline.map((entry) => ["timeline", entry.type, entry.label, entry.status, "", round.impact.formulaVersion, round.number, round.side, round.won, entry.tick, entry.seconds, entry.context ?? ""]),
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

function Status({ value }: { value: MetricValue | { status: string } }) {
  return <span className={`demo-status status-${value.status}`}>{value.status}</span>;
}

export default function DemoParserView({
  initialReportId,
  reportOnly = false,
}: {
  initialReportId?: string;
  reportOnly?: boolean;
} = {}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [players, setPlayers] = useState<DemoPlayer[]>([]);
  const [map, setMap] = useState<string | null>(null);
  const [report, setReport] = useState<DemoReport | null>(null);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [view, setView] = useState<"match" | "rounds" | "detail">("match");
  const [side, setSide] = useState("all");
  const [outcome, setOutcome] = useState("all");
  const [action, setAction] = useState("all");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  async function refreshSaved() {
    const response = await fetch("/api/demo-parser/reports", { cache: "no-store" });
    if (!response.ok) return [];
    const reports = (await jsonResponse<{ reports: SavedReport[] }>(response, "Saved reports could not be read")).reports;
    setSaved(reports);
    return reports;
  }

  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.json()).then(setProfile);
    if (!reportOnly) void refreshSaved().then((reports) => {
      if (reports[0]) void loadReport(reports[0].id);
    });
    if (initialReportId) void loadReport(initialReportId);
  }, [initialReportId, reportOnly]);

  async function inspect() {
    if (!file) return;
    setBusy(true); setError(""); setReport(null); setPlayers([]);
    try {
      const form = new FormData(); form.set("mode", "inspect"); form.set("demo", file);
      const response = await fetch("/api/demo-parser", { method: "POST", body: form });
      const body = await jsonResponse<{ error?: string; players: DemoPlayer[]; map: string | null }>(response, "Demo inspection failed");
      if (!response.ok) throw new Error(body.error ?? "Demo inspection failed.");
      setPlayers(body.players); setMap(body.map);
      if (!body.players.some((player: DemoPlayer) => player.steamId64 === profile?.steamId))
        setError(`Your SteamID64 ${profile?.steamId ?? "is unknown"} was not found. A report was not created.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Demo inspection failed."); }
    finally { setBusy(false); }
  }

  async function analyze() {
    if (!file || !profile?.steamId || !players.some((player) => player.steamId64 === profile.steamId)) return;
    setBusy(true); setError("");
    try {
      localStorage.setItem("mindcheck.demoPlayerSteamId64", profile.steamId);
      const form = new FormData(); form.set("mode", "analyze"); form.set("steamId64", profile.steamId); form.set("demo", file);
      const response = await fetch("/api/demo-parser", { method: "POST", body: form });
      const body = await jsonResponse<DemoReport & { error?: string }>(response, "Demo analysis failed");
      if (!response.ok) throw new Error(body.error ?? "Demo analysis failed.");
      setReport(body); setView("match"); await refreshSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Demo analysis failed."); }
    finally { setBusy(false); }
  }

  async function loadReport(id: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/demo-parser/reports?id=${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await jsonResponse<DemoReport & { error?: string }>(response, "Report could not be loaded");
      if (!response.ok) throw new Error(body.error ?? "Report could not be loaded.");
      setReport(body); setView("match");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Report could not be loaded."); }
    finally { setBusy(false); }
  }

  async function removeReport(item: SavedReport) {
    if (!window.confirm(`Delete the saved ${item.map ?? "unknown map"} report?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/demo-parser/reports?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const body = await jsonResponse<{ deleted?: boolean; error?: string }>(response, "Report could not be deleted");
      if (!response.ok) throw new Error(body.error ?? "Report could not be deleted.");
      setSaved((current) => current.filter((reportItem) => reportItem.id !== item.id));
      if (report?.id === item.id) {
        setReport(null);
        const next = saved.find((reportItem) => reportItem.id !== item.id);
        if (next) void loadReport(next.id);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Report could not be deleted.");
    }
  }

  async function analyzeSteamHistory() {
    setBusy(true); setError(""); setProgress("Reading Steam demo queue…");
    try {
      const queueResponse = await fetch("/api/demo-parser/steam", { cache: "no-store" });
      const queueBody = await jsonResponse<{ error?: string; matches: Array<{ id: string; map: string | null }> }>(queueResponse, "Steam queue is unavailable");
      if (!queueResponse.ok) throw new Error(queueBody.error ?? "Steam queue is unavailable.");
      const matches = queueBody.matches as Array<{ id: string; map: string | null }>;
      for (let index = 0; index < matches.length; index++) {
        setProgress(`Analyzing ${index + 1}/${matches.length}: ${matches[index].map ?? "unknown map"} (newest to oldest)`);
        const response = await fetch("/api/demo-parser/steam", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId: matches[index].id }) });
        const body = await jsonResponse<DemoReport & { error?: string }>(response, `Steam match ${index + 1} analysis failed`);
        if (!response.ok) throw new Error(`Stopped at match ${index + 1}: ${body.error ?? "analysis failed"}`);
        setReport(body);
      }
      setProgress(matches.length ? `Analyzed ${matches.length} match(es).` : "No new Steam demos among the latest 30 matches.");
      const reports = await refreshSaved();
      if (reports[0]) await loadReport(reports[0].id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Steam history analysis failed."); }
    finally { setBusy(false); }
  }

  const filteredRounds = useMemo(() => report?.rounds.filter((round) =>
    (side === "all" || round.side === side) &&
    (outcome === "all" || (outcome === "win" ? round.won : !round.won)) &&
    (action === "all" || round.timeline.some((entry) => entry.type === action)),
  ) ?? [], [report, side, outcome, action]);
  const detailedRound = report?.rounds.find((round) => round.number === selectedRound) ?? null;

  return <div className="stack demo-parser">
    <div className="heading"><div><p className="eyebrow">DEMOPARSER / PERSONAL IMPACT</p><h1>{reportOnly ? <>Saved match <span>report</span></> : <>CS2 demo <span>analysis</span></>}</h1></div>{reportOnly && <Link className="secondary" href="/">Back to Dashboard</Link>}</div>
    {busy && reportOnly && <p className="loading">Loading saved report…</p>}
    {error && <p className="error">{error}</p>}
    {!reportOnly && <>
    <section className="panel demo-upload">
      <div className="panel-title"><Upload /><h2>Load a match</h2></div>
      <div className="toolbar">
        <input type="file" accept=".dem" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPlayers([]); setReport(null); }} />
        <button className="primary" disabled={!file || busy} onClick={() => void inspect()}><FileSearch size={16} /> Discover players</button>
        <button className="secondary" disabled={busy} onClick={() => void analyzeSteamHistory()}><History size={16} /> Analyze new Steam demos</button>
      </div>
      {progress && <p className="hint">{progress}</p>}
      {players.length > 0 && <div className="player-picker">
        <p><strong>{map ?? "Unknown map"}</strong> · detected players</p>
        <div>{players.map((player) => <span className={player.steamId64 === profile?.steamId ? "authorized-player" : ""} key={player.steamId64}>{player.name} <small>{player.steamId64}</small>{player.steamId64 === profile?.steamId && " · authorized Mindcheck user"}</span>)}</div>
        <label>Personal report SteamID64
          <select value={profile?.steamId ?? ""} disabled><option>{profile?.steamId ?? "Sign in with Steam"}</option></select>
        </label>
        <button className="primary" disabled={busy || !profile?.steamId || !players.some((player) => player.steamId64 === profile.steamId)} onClick={() => void analyze()}>Create personal report</button>
      </div>}
    </section>

    </>}

    {report && <>
      <div className="demo-tabs">
        <button className={view === "match" ? "active" : ""} onClick={() => setView("match")}>Match</button>
        <button className={view === "rounds" ? "active" : ""} onClick={() => setView("rounds")}>Rounds</button>
        <button className={view === "detail" ? "active" : ""} disabled={!detailedRound} onClick={() => setView("detail")}>Round detail</button>
        <span className="push" />
        <button className="text-button" onClick={() => download(`mindcheck-${report.id}.json`, JSON.stringify(report, null, 2), "application/json")}><Download size={15} /> JSON</button>
        <button className="text-button" onClick={() => download(`mindcheck-${report.id}.csv`, reportCsv(report), "text/csv;charset=utf-8")}><Download size={15} /> CSV</button>
        {!reportOnly && saved.some((item) => item.id === report.id) && <button className="text-button" onClick={() => void removeReport(saved.find((item) => item.id === report.id)!)}><Trash2 size={15} /> Delete report</button>}
      </div>

      {view === "match" && <MatchView report={report} />}
      {view === "rounds" && <section className="panel">
        <div className="toolbar"><select value={side} onChange={(event) => setSide(event.target.value)}><option value="all">All sides</option><option value="T">T</option><option value="CT">CT</option></select><select value={outcome} onChange={(event) => setOutcome(event.target.value)}><option value="all">All outcomes</option><option value="win">Won</option><option value="loss">Lost</option></select><select value={action} onChange={(event) => setAction(event.target.value)}><option value="all">All actions</option><option value="kill">Kill</option><option value="trade">Trade</option><option value="first-kill">First kill</option><option value="plant">Plant</option><option value="defuse">Defuse</option><option value="clutch">Clutch</option></select></div>
        <div className="demo-table-wrap"><table className="demo-table"><thead><tr><th>Round</th><th>Result</th><th>Side</th><th>K/A/D</th><th>Damage</th><th>Trades</th><th>Objective</th><th>Impact</th></tr></thead><tbody>{filteredRounds.map((round) => <tr key={round.number} onClick={() => { setSelectedRound(round.number); setView("detail"); }}><td>#{round.number}</td><td>{round.won == null ? "?" : round.won ? "Win" : "Loss"}</td><td>{round.side ?? "?"}</td><td>{round.kills}/{round.assists}/{round.deaths}</td><td>{round.enemyDamage}</td><td>{round.tradeKills}</td><td>{round.plants ? "Plant" : round.defuses ? "Defuse" : "—"}</td><td><strong>{round.impact.value}</strong>{round.impact.incomplete && "*"}</td></tr>)}</tbody></table></div>
      </section>}
      {view === "detail" && detailedRound && <RoundDetail round={detailedRound} />}
    </>}
  </div>;
}

function MatchView({ report }: { report: DemoReport }) {
  return <div className="stack">
    <section className="demo-match-head"><div><p className="eyebrow">{report.map ?? "UNKNOWN MAP"}</p><h2>{report.score ? `${report.score.team} : ${report.score.enemy}` : "Score unavailable"}</h2><p className="muted">{report.player.name} · {report.player.steamId64} · {report.roundsPlayed} participated rounds</p></div><div className="impact-hero"><span>Personal impact</span><strong>{report.impact.value}</strong><small>{report.impact.incomplete ? "Incomplete data" : "Complete for available event definitions"} · {report.impact.formulaVersion}</small></div></section>
    {report.warnings.length > 0 && <div className="demo-warning">{report.warnings.map((warning) => <div key={warning}>{warning}</div>)}</div>}
    <section className="metric-grid demo-metrics">{Object.entries(report.metrics).map(([key, item]) => <div className="metric" key={key}><span>{metricLabels[key] ?? key}</span><strong>{item.value ?? "—"}</strong><Status value={item} />{item.note && <small>{item.note}</small>}</div>)}</section>
    <section className="demo-columns"><div className="panel"><h2>Impact composition</h2><p className="hint">50 = neutral baseline; 0 and 100 are configured bounds. This is a Mindcheck heuristic, not an official rating or win probability.</p>{report.impact.components.map((component) => <div className="impact-line" key={component.key}><span>{component.label}<small>{component.detail}</small></span><strong>{component.points >= 0 ? "+" : ""}{component.points}</strong></div>)}</div><div className="panel"><h2>By side</h2>{(["T", "CT"] as const).map((side) => <div className="side-line" key={side}><strong>{side}</strong><span>{report.sides[side].rounds} rounds · {report.sides[side].kills}/{report.sides[side].assists}/{report.sides[side].deaths} · {report.sides[side].damage} damage</span><b>{report.sides[side].impact ?? "—"}</b></div>)}<h3>Data availability</h3>{Object.entries(report.availability).map(([key, value]) => <div className="availability" key={key}><span>{key}</span><Status value={value} /></div>)}</div></section>
  </div>;
}

function RoundDetail({ round }: { round: RoundReport }) {
  return <div className="demo-columns"><section className="panel"><p className="eyebrow">ROUND {round.number} / {round.side ?? "SIDE UNKNOWN"}</p><h2>{round.won == null ? "Outcome unknown" : round.won ? "Round won" : "Round lost"} · impact {round.impact.value}{round.impact.incomplete && "*"}</h2><div className="round-summary">K/A/D {round.kills}/{round.assists}/{round.deaths} · {round.enemyDamage} damage · {round.tradeKills} trades{round.clutchWon ? ` · 1v${round.clutchVs} clutch` : ""}</div><div className="timeline">{round.timeline.length ? round.timeline.map((entry, index) => <div key={`${entry.tick}-${entry.type}-${index}`}><time>{entry.seconds == null ? `tick ${entry.tick}` : `${entry.seconds.toFixed(1)}s`}</time><span><strong>{entry.label}</strong><small>{entry.context}</small></span><Status value={entry} /></div>) : <p className="empty">No personal actions recorded in this round.</p>}</div></section><section className="panel"><h2>Score origin</h2><p className="hint">Every component is capped by the formula configuration. Grenade damage is shown separately but is not added twice.</p>{round.impact.components.map((component) => <div className="impact-line" key={component.key}><span>{component.label}<small>{component.detail}</small></span><strong>{component.points >= 0 ? "+" : ""}{Math.round(component.points * 10) / 10}</strong></div>)}</section></div>;
}
