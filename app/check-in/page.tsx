"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Controller, useForm } from "react-hook-form";
import {
  CalendarDays,
  Moon,
  Zap,
  Check,
  Activity,
  ArrowUpRight,
  Plus,
} from "lucide-react";
import { useData } from "@/components/data-provider";
import { TriCheck, NumberField, Choice } from "@/components/fields";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  checks,
  scales,
  DailyInput,
  blankDay,
  dayInput,
  localDate,
  localDateTime,
  formatDate,
} from "@/lib/model";
export default function CheckIn() {
  const { data, loading, mutate } = useData();
  const [date, setDate] = useState(localDate);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sessionName, setSessionName] = useState("Evening session");
  const [sessionBusy, setSessionBusy] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const loaded = useRef("");
  const form = useForm<DailyInput>({ defaultValues: blankDay(date) });
  const {
    control,
    handleSubmit,
    reset,
    register,
    formState: { isDirty, isSubmitting },
  } = form;
  const saved = data.dailyLogs.find((d) => d.date === date);
  const sessions = data.sessions.filter((s) => s.dailyLogId === saved?.id);
  const selectedSession = data.sessions.find((session) => session.id === selectedSessionId) ?? null;
  const sessionRows = data.sessions
    .map((session) => {
      const day = data.dailyLogs.find((item) => item.id === session.dailyLogId);
      return {
        session,
        day,
        pending: !day?.checkedInAt,
        matches: data.matches.filter((match) => match.sessionId === session.id).length,
      };
    })
    .sort((a, b) => Number(b.pending) - Number(a.pending) || b.session.startedAt.localeCompare(a.session.startedAt));
  useEffect(() => {
    if (!loading && loaded.current !== date) {
      reset(saved ? dayInput(saved) : blankDay(date));
      loaded.current = date;
    }
  }, [loading, date, saved, reset]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
  function changeDate(next: string) {
    if (!next) return;
    if (isDirty && !window.confirm("Discard unsaved check-in changes?")) return;
    setDate(next);
    setSelectedSessionId(null);
    setMessage("");
    setError("");
  }
  function openSession(sessionId: string) {
    const session = data.sessions.find((item) => item.id === sessionId);
    const day = data.dailyLogs.find((item) => item.id === session?.dailyLogId);
    if (!session || !day) return;
    if (isDirty && !window.confirm("Discard unsaved check-in changes?")) return;
    setSelectedSessionId(session.id);
    setDate(day.date);
    reset(dayInput(day));
    loaded.current = day.date;
    setMessage("");
    setError("");
    requestAnimationFrame(() => document.getElementById("session-check-in-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }
  async function save(values: DailyInput) {
    setError("");
    setMessage("");
    try {
      await mutate("/api/daily-logs", "PUT", { ...values, date });
      reset(values);
      setMessage("Check-in saved.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function addSession() {
    setError("");
    setSessionBusy(true);
    try {
      await mutate("/api/sessions", "POST", {
        date,
        name: sessionName,
        startedAt: new Date(
          date + "T" + localDateTime().slice(11),
        ).toISOString(),
      });
      setMessage("Session created. Add your matches in the match log.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSessionBusy(false);
    }
  }
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">DAILY CHECK-IN</p>
          <h1>
            Check your state.
            <br />
            <span>Then start your game.</span>
          </h1>
        </div>
        <label className="datebox">
          <CalendarDays size={18} />
          <input
            aria-label="Check-in date"
            type="date"
            value={date}
            onChange={(e) => changeDate(e.target.value)}
          />
        </label>
      </div>
      {loading && (
        <p className="loading" role="status">
          Loading your journal…
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {sessionRows.length > 0 && (
        <section className="panel session-checkins">
          <div className="panel-title">
            <CalendarDays />
            <h2>Session check-ins</h2>
            <span className="push muted">{sessionRows.filter((row) => row.pending).length} need attention</span>
          </div>
          <div className="demo-table-wrap">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Matches</TableHead>
                  <TableHead>Check-in</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionRows.map(({ session, day, pending, matches }) => (
                  <TableRow
                    key={session.id}
                    className={`session-checkin-row ${selectedSessionId === session.id ? "selected" : ""}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => openSession(session.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") openSession(session.id);
                    }}
                  >
                    <TableCell>
                      <div>{day ? formatDate(day.date) : "—"}</div>
                      <small className="subtle">{new Date(session.startedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</small>
                    </TableCell>
                    <TableCell><strong>{session.name}</strong></TableCell>
                    <TableCell>{matches}</TableCell>
                    <TableCell><span className={pending ? "badge session-pending" : "badge session-complete"}>{pending ? "Needs check-in" : "Completed"}</span></TableCell>
                    <TableCell><button type="button" className="text-button" onClick={(event) => { event.stopPropagation(); openSession(session.id); }}>{pending ? "Fill" : "Edit"}</button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
      {selectedSession && <p className="session-context">Check-in for <strong>{selectedSession.name}</strong> · started {new Date(selectedSession.startedAt).toLocaleString("en-GB")}</p>}
      <form id="session-check-in-form" onSubmit={handleSubmit(save)} className="workspace">
        <section className="panel">
          <div className="panel-title">
            <Moon />
            <h2>Body & preparation</h2>
            <span className="step">01</span>
          </div>
          <div className="number-row">
            <Controller
              name="sleepHours"
              control={control}
              render={({ field }) => (
                <NumberField
                  label="Sleep · hours"
                  value={field.value}
                  onChange={field.onChange}
                  min={0}
                  max={24}
                  step={0.5}
                />
              )}
            />
            <Controller
              name="warmupMinutes"
              control={control}
              render={({ field }) => (
                <NumberField
                  label="Warmup · minutes"
                  value={field.value}
                  onChange={field.onChange}
                  min={0}
                  max={600}
                />
              )}
            />
          </div>
          <div className="checks">
            {checks.map(([key, label]) => (
              <Controller
                key={key}
                name={key}
                control={control}
                render={({ field }) => (
                  <TriCheck
                    label={label}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            ))}
          </div>
          <p className="hint">Click to cycle: not logged → yes → no.</p>
          <label className="settings-label">
            Caffeine
            <Controller
              name="caffeine"
              control={control}
              render={({ field }) => (
                <Choice
                  label="Caffeine"
                  value={field.value}
                  onChange={field.onChange}
                  options={["NONE", "LOW", "MEDIUM", "HIGH"].map((v) => [
                    v,
                    v[0] + v.slice(1).toLowerCase(),
                  ])}
                />
              )}
            />
          </label>
        </section>
        <section className="panel">
          <div className="panel-title">
            <Zap />
            <h2>How are you feeling?</h2>
            <span className="step">02</span>
          </div>
          <p className="hint">
            1 is low, 10 is high. Stress and tilt work the same way.
          </p>
          <div className="scales">
            {scales.map(([key, label]) => (
              <Controller
                key={key}
                name={key}
                control={control}
                render={({ field }) => (
                  <NumberField
                    label={label}
                    value={field.value}
                    onChange={field.onChange}
                    min={1}
                    max={10}
                  />
                )}
              />
            ))}
          </div>
          <label className="notes">
            Anything else on your mind?
            <textarea
              placeholder="A busy day, playing with friends, a new routine…"
              {...register("notes")}
            />
          </label>
          <div className="toolbar">
            <button
              className="primary"
              disabled={loading || isSubmitting}
              type="submit"
            >
              <Check size={18} />
              {isSubmitting ? "Saving…" : "Save check-in"}
            </button>
            <span className="subtle">
              {isDirty
                ? "Unsaved changes"
                : saved?.checkedInAt
                  ? "Saved for this day"
                  : "Not logged yet"}
            </span>
          </div>
          {message && (
            <p className="success" role="status">
              {message}
            </p>
          )}
        </section>
        <aside>
          <div className="aside-note">
            <Activity />
            <h3>Your context matters.</h3>
            <p>Log how you feel before playing. Rate each match afterwards.</p>
            <p>Blank fields stay unknown. They never count as “no”.</p>
          </div>
          <div className="connection-teaser">
            <span className="eyebrow">SESSIONS TODAY</span>
            <h3>
              {sessions.length
                ? `${sessions.length} session${sessions.length > 1 ? "s" : ""}`
                : "Make room for a game."}
            </h3>
            {sessions.map((s) => (
              <p key={s.id}>
                <Link href={`/matches?session=${s.id}`}>
                  {s.name}{" "}
                  <ArrowUpRight size={14} style={{ display: "inline" }} />
                </Link>
              </p>
            ))}
            <label className="settings-label">
              Session name
              <input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="Evening session"
              />
            </label>
            <button
              type="button"
              className="secondary"
              onClick={() => void addSession()}
              disabled={sessionBusy || !sessionName.trim() || loading}
            >
              <Plus size={16} />
              New session
            </button>
          </div>
        </aside>
      </form>
      {data.dailyLogs.some((d) => d.checkedInAt) && (
        <section className="history-strip">
          <p className="eyebrow">RECENT CHECK-INS</p>
          <div className="saved-days">
            {data.dailyLogs
              .filter((d) => d.checkedInAt)
              .slice(0, 20)
              .map((d) => (
                <button key={d.id} onClick={() => changeDate(d.date)}>
                  {formatDate(d.date)}
                </button>
              ))}
          </div>
        </section>
      )}
    </>
  );
}
