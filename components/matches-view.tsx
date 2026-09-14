"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Plus, Target, Pencil, Trash2, CalendarDays } from "lucide-react";
import { useData } from "@/components/data-provider";
import { Choice, NumberField, TriCheck } from "@/components/fields";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  assessments,
  blankMatch,
  Match,
  MatchInput,
  matchInput,
  localDate,
  localDateTime,
  formatDate,
  display,
} from "@/lib/model";
export default function MatchesView() {
  const { data, loading, mutate } = useData();
  const search = useSearchParams();
  const [filter, setFilter] = useState<string | null>(search.get("session"));
  const [platform, setPlatform] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [deleting, setDeleting] = useState<Match | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [sessionName, setSessionName] = useState("Evening session");
  const [sessionDate, setSessionDate] = useState(localDate);
  const [sessionTime, setSessionTime] = useState("19:00");
  const [sessionError, setSessionError] = useState("");
  const [sessionBusy, setSessionBusy] = useState(false);
  const form = useForm<MatchInput>({ defaultValues: blankMatch() });
  const {
    control,
    register,
    reset,
    handleSubmit,
    formState: { isSubmitting, isDirty },
  } = form;
  const selectedSessionId = useWatch({ control, name: "sessionId" });
  const options = data.sessions.map(
    (s) =>
      [
        s.id,
        `${data.dailyLogs.find((d) => d.id === s.dailyLogId)?.date ?? ""} · ${s.name}`,
      ] as [string, string],
  );
  const matches = data.matches.filter(
    (m) =>
      (!filter || m.sessionId === filter) &&
      (!platform || m.platform === platform),
  );
  function showMatch(match?: Match) {
    setError("");
    setEditing(match?.id ?? null);
    if (match) reset(matchInput(match));
    else {
      const selected = filter || data.sessions[0]?.id || "";
      const day = data.dailyLogs.find(
        (d) =>
          d.id === data.sessions.find((s) => s.id === selected)?.dailyLogId,
      );
      reset({
        ...blankMatch(selected),
        playedAt: new Date(
          (day?.date ?? localDate()) + "T" + localDateTime().slice(11),
        ).toISOString(),
      });
    }
    setOpen(true);
  }
  function close(next: boolean) {
    if (!next && isDirty && !window.confirm("Discard unsaved match changes?"))
      return;
    setOpen(next);
  }
  async function save(input: MatchInput) {
    setError("");
    try {
      await mutate(
        editing ? `/api/matches/${editing}` : "/api/matches",
        editing ? "PUT" : "POST",
        input,
      );
      reset(input);
      setOpen(false);
      setMessage(editing ? "Match updated." : "Match logged.");
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    setSessionBusy(true);
    setSessionError("");
    try {
      const s = await mutate("/api/sessions", "POST", {
        date: sessionDate,
        name: sessionName,
        startedAt: new Date(`${sessionDate}T${sessionTime}`).toISOString(),
      });
      setFilter(s.id);
      setSessionOpen(false);
      setMessage("Session created. You can now add a match.");
    } catch (e) {
      setSessionError((e as Error).message);
    } finally {
      setSessionBusy(false);
    }
  }
  async function removeMatch() {
    if (!deleting) return;
    setDeleteBusy(true);
    setError("");
    try {
      await mutate(`/api/matches/${deleting.id}`, "DELETE");
      setDeleting(null);
      setMessage("Match deleted.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleteBusy(false);
    }
  }
  return (
    <>
      <div className="heading">
        <div>
          <p className="eyebrow">MATCH LOG</p>
          <h1>
            Every match.
            <br />
            <span>Your perspective.</span>
          </h1>
        </div>
        <div className="toolbar">
          <button
            className="secondary"
            onClick={() => setSessionOpen(true)}
            disabled={loading}
          >
            <CalendarDays size={16} />
            New session
          </button>
          <button
            className="primary"
            onClick={() => showMatch()}
            disabled={!data.sessions.length || loading}
          >
            <Plus size={18} />
            Log a match
          </button>
        </div>
      </div>
      {message && (
        <p role="status" className="success section-gap">
          {message}
        </p>
      )}
      {error && !open && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="toolbar">
        <div style={{ minWidth: 240 }}>
          <Choice
            label="Filter by session"
            value={filter}
            onChange={setFilter}
            options={options}
            placeholder="All sessions"
          />
        </div>
        <Choice
          label="Filter by platform"
          value={platform}
          onChange={setPlatform}
          options={[
            ["VALVE", "Valve"],
            ["FACEIT", "FACEIT"],
          ]}
          placeholder="All platforms"
        />
        <span className="muted">{matches.length} matches</span>
      </div>
      <section className="panel">
        {loading ? (
          <p className="loading">Loading matches…</p>
        ) : !data.sessions.length ? (
          <div className="empty">
            <CalendarDays />
            <h3>Start with a session.</h3>
            <p>
              One day can have several sessions. Each session holds its own
              matches.
            </p>
            <button className="primary" onClick={() => setSessionOpen(true)}>
              Create first session
            </button>
          </div>
        ) : !matches.length ? (
          <div className="empty">
            <Target />
            <h3>No matches here yet.</h3>
            <p>Add a match to this session or choose a different filter.</p>
            <button className="secondary" onClick={() => showMatch()}>
              Log a match
            </button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  "Played",
                  "Session",
                  "Map",
                  "Result",
                  "K / D / A",
                  "K/D",
                  "ADR",
                  "HS %",
                  "Self-rating",
                  "",
                ].map((h, i) => (
                  <TableHead key={i}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {matches.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <div>{formatDate(m.playedAt)}</div>
                    <small className="subtle">
                      {new Date(m.playedAt).toLocaleTimeString("en-GB", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  </TableCell>
                  <TableCell>
                    {data.sessions.find((s) => s.id === m.sessionId)?.name ??
                      "—"}
                  </TableCell>
                  <TableCell>
                    <strong>{m.map || "Not recorded"}</strong>
                    <div className="subtle">
                      {m.platform === "VALVE" ? "Valve" : "FACEIT"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`result-${m.result}`}>
                      {m.result ?? "—"}
                    </span>
                    <div className="subtle">
                      {m.teamScore ?? "—"} : {m.enemyScore ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    {m.kills ?? "—"} / {m.deaths ?? "—"} / {m.assists ?? "—"}
                  </TableCell>
                  <TableCell>
                    {display(
                      m.kills === null || !m.deaths ? null : m.kills / m.deaths,
                      2,
                    )}
                  </TableCell>
                  <TableCell>{display(m.adr)}</TableCell>
                  <TableCell>{display(m.headshot, 0)}</TableCell>
                  <TableCell>
                    {m.performance === null ? "—" : `${m.performance}/10`}
                  </TableCell>
                  <TableCell>
                    <div className="row-actions">
                      <button
                        className="icon-button"
                        aria-label={`Edit match ${m.map || "untitled"}`}
                        onClick={() => showMatch(m)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Delete match ${m.map || "untitled"}`}
                        onClick={() => {
                          setError("");
                          setDeleting(m);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
      <p className="hint section-gap">
        Manual entries only for this iteration. Steam imports and match
        verification come later.
      </p>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="modal-scroll sm:max-w-3xl">
          <DialogTitle>{editing ? "Edit match" : "Log a match"}</DialogTitle>
          <DialogDescription>
            Record what happened and how you played. Stats can be left blank.
          </DialogDescription>
          <form onSubmit={handleSubmit(save)} className="stack">
            <div className="formgrid">
              <label className="wide">
                Session
                <Controller
                  name="sessionId"
                  control={control}
                  render={({ field }) => (
                    <Choice
                      label="Match session"
                      value={field.value}
                      onChange={(v) => field.onChange(v ?? "")}
                      options={options}
                      placeholder="Choose a session"
                    />
                  )}
                />
              </label>
              <label>
                Played at
                <Controller
                  name="playedAt"
                  control={control}
                  render={({ field }) => (
                    <input
                      aria-label="Played at"
                      type="datetime-local"
                      required
                      value={
                        field.value ? localDateTime(new Date(field.value)) : ""
                      }
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            ? new Date(e.target.value).toISOString()
                            : "",
                        )
                      }
                    />
                  )}
                />
              </label>
              <label>
                Platform
                <Controller
                  name="platform"
                  control={control}
                  render={({ field }) => (
                    <Choice
                      label="Match platform"
                      value={field.value}
                      onChange={(v) => field.onChange(v ?? "VALVE")}
                      options={[
                        ["VALVE", "Valve"],
                        ["FACEIT", "FACEIT"],
                      ]}
                    />
                  )}
                />
              </label>
              <label>
                Map
                <input placeholder="e.g. Mirage" {...register("map")} />
              </label>
              <label>
                Result
                <Controller
                  name="result"
                  control={control}
                  render={({ field }) => (
                    <Choice
                      label="Match result"
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        ["WIN", "Win"],
                        ["LOSS", "Loss"],
                        ["DRAW", "Draw"],
                      ]}
                    />
                  )}
                />
              </label>
            </div>
            <h3 className="form-heading">Scoreboard</h3>
            <div className="formgrid stats-inputs">
              {[
                ["teamScore", "Our rounds"],
                ["enemyScore", "Their rounds"],
                ["kills", "Kills"],
                ["deaths", "Deaths"],
                ["assists", "Assists"],
                ["adr", "ADR"],
                ["headshot", "Headshot %"],
                ["rating", "Rating (optional)"],
              ].map(([key, label]) => (
                <Controller
                  key={key}
                  name={key as "kills"}
                  control={control}
                  render={({ field }) => (
                    <NumberField
                      label={label}
                      value={field.value}
                      onChange={field.onChange}
                      step={
                        ["adr", "rating", "headshot"].includes(key) ? 0.01 : 1
                      }
                    />
                  )}
                />
              ))}
            </div>
            <h3 className="form-heading">Your read on the game</h3>
            <p className="subtle">
              Self-ratings: 1–10. Optional; no match verification yet.
            </p>
            <div className="formgrid stats-inputs">
              {assessments.map(([key, label]) => (
                <Controller
                  key={key}
                  name={key}
                  control={control}
                  render={({ field }) => (
                    <NumberField
                      label={label}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
              ))}
            </div>
            <div className="formgrid">
              <Controller
                name="tilted"
                control={control}
                render={({ field }) => (
                  <TriCheck
                    label="Tilted during the match"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
              <Controller
                name="tired"
                control={control}
                render={({ field }) => (
                  <TriCheck
                    label="Felt tired"
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <label className="notes">
              Notes
              <textarea
                placeholder="What worked? What would you change?"
                {...register("notes")}
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="toolbar">
              <button
                className="primary"
                type="submit"
                disabled={isSubmitting || !selectedSessionId}
              >
                {isSubmitting
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Save match"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => close(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
        <DialogContent>
          <DialogTitle>New session</DialogTitle>
          <DialogDescription>
            Group matches from the same sitting. A session stays linked to its
            check-in day, including games after midnight.
          </DialogDescription>
          <form onSubmit={createSession} className="stack">
            <label className="settings-label">
              Check-in day
              <input
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
              />
            </label>
            <label className="settings-label">
              Session name
              <input
                required
                maxLength={100}
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
              />
            </label>
            <label className="settings-label">
              Start time
              <input
                type="time"
                required
                value={sessionTime}
                onChange={(e) => setSessionTime(e.target.value)}
              />
            </label>
            {sessionError && (
              <p className="error" role="alert">
                {sessionError}
              </p>
            )}
            <button
              type="submit"
              className="primary"
              disabled={sessionBusy || !sessionName.trim()}
            >
              {sessionBusy ? "Creating…" : "Create session"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(v) => {
          if (!v && !deleteBusy) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete this match?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes the match and its self-ratings. Your daily check-in and
            session are kept.
          </AlertDialogDescription>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBusy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteBusy}
              onClick={(e) => {
                e.preventDefault();
                void removeMatch();
              }}
            >
              {deleteBusy ? "Deleting…" : "Delete match"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
