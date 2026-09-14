import "dotenv/config";
import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { blankDay, blankMatch, AppData } from "../lib/model";
const base = "http://127.0.0.1:5173";
const date = "1999-12-31";
let dayId: string | undefined;
async function request(path: string, method = "GET", body?: unknown) {
  const r = await fetch(base + path, {
    method,
    headers: { Origin: base, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await r.json();
  assert.ok(r.ok, `${method} ${path}: ${r.status} ${JSON.stringify(json)}`);
  return json;
}
try {
  assert.equal(
    await prisma.dailyLog.findUnique({ where: { date: new Date(date) } }),
    null,
    "Test date already occupied; refusing to change existing data.",
  );
  const session = await request("/api/sessions", "POST", {
    date,
    name: "MINDCHECK_API_SMOKE",
    startedAt: "1999-12-31T19:00:00.000Z",
  });
  dayId = session.dailyLogId;
  let state: AppData = await request("/api/data");
  assert.equal(state.dailyLogs.find((d) => d.id === dayId)?.checkedInAt, null);
  const input = {
    ...blankDay(date),
    sleepHours: 0,
    sleepOk: false,
    energy: 7,
    notes: "MINDCHECK_API_SMOKE",
  };
  await request("/api/daily-logs", "PUT", input);
  await request("/api/daily-logs", "PUT", input);
  state = await request("/api/data");
  assert.equal(state.dailyLogs.filter((d) => d.date === date).length, 1);
  assert.equal(state.dailyLogs.find((d) => d.id === dayId)?.sleepOk, false);
  assert.equal(state.dailyLogs.find((d) => d.id === dayId)?.sleepHours, 0);
  assert.equal(state.dailyLogs.find((d) => d.id === dayId)?.hydrated, null);
  const m1 = {
    ...blankMatch(session.id),
    playedAt: "2000-01-01T00:30:00.000Z",
    map: "SMOKE Mirage",
    kills: 20,
    deaths: 10,
    adr: 80,
    performance: 7,
    result: "WIN",
  };
  const created = await request("/api/matches", "POST", m1);
  await request(`/api/matches/${created.id}`, "PUT", {
    ...m1,
    notes: "edited",
    performance: 8,
  });
  const second = await request("/api/matches", "POST", {
    ...blankMatch(session.id),
    map: "SMOKE Nuke",
  });
  state = await request("/api/data");
  assert.equal(
    state.matches.filter((m) => m.sessionId === session.id).length,
    2,
  );
  assert.equal(state.matches.find((m) => m.id === created.id)?.performance, 8);
  assert.equal(state.matches.find((m) => m.id === second.id)?.kills, null);
  await request(`/api/matches/${created.id}`, "DELETE");
  state = await request("/api/data");
  assert.ok(!state.matches.some((m) => m.id === created.id));
  assert.ok(state.sessions.some((s) => s.id === session.id));
  console.log(
    "PASS: PostgreSQL persistence, nullable fields, day upsert, sessions, after-midnight match, edit, delete and state refresh.",
  );
} finally {
  if (dayId) {
    await prisma.$transaction(async (tx) => {
      await tx.match.deleteMany({ where: { session: { dailyLogId: dayId } } });
      await tx.session.deleteMany({ where: { dailyLogId: dayId } });
      await tx.dailyLog.delete({ where: { id: dayId } });
    });
    console.log("Removed only the test records created by this run.");
  }
  await prisma.$disconnect();
}
