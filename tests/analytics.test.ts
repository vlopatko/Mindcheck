import test from "node:test";
import assert from "node:assert/strict";
import {
  average,
  kd,
  winRate,
  pearson,
  dailyRows,
  correlation,
  compareHabit,
} from "../lib/analytics";
import {
  blankDay,
  blankMatch,
  hasCheckin,
  AppData,
  DailyLog,
  Match,
} from "../lib/model";
function day(
  id: string,
  date: string,
  extra: Partial<DailyLog> = {},
): DailyLog {
  return {
    ...blankDay(date),
    id,
    createdAt: date,
    updatedAt: date,
    checkedInAt: date,
    ...extra,
  };
}
function match(
  id: string,
  sessionId: string,
  extra: Partial<Match> = {},
): Match {
  return {
    ...blankMatch(sessionId),
    id,
    createdAt: "",
    updatedAt: "",
    steamMatchId: null,
    shareCode: null,
    demoUrl: null,
    ...extra,
  };
}
test("unknowns stay unknown; false and zero remain real observations", () => {
  assert.equal(hasCheckin(blankDay("2026-09-13")), false);
  assert.equal(hasCheckin({ ...blankDay("2026-09-13"), sleepOk: false }), true);
  assert.equal(average([null, 0, 10]), 5);
  assert.equal(average([null, undefined]), null);
});
test("overall K/D uses complete pairs and pooled totals", () => {
  assert.equal(
    kd([
      match("1", "s", { kills: 10, deaths: 2 }),
      match("2", "s", { kills: 10, deaths: 8 }),
      match("3", "s", { kills: 100, deaths: null }),
    ]),
    2,
  );
  assert.equal(kd([match("1", "s", { kills: 5, deaths: 0 })]), null);
  assert.equal(kd([]), null);
});
test("draws are included; unrecorded outcomes are excluded", () => {
  assert.equal(
    winRate([
      match("1", "s", { result: "WIN" }),
      match("2", "s", { result: "DRAW" }),
      match("3", "s", { result: null }),
    ]),
    50,
  );
  assert.equal(winRate([]), null);
});
test("Pearson handles positive, negative, constant and insufficient samples", () => {
  assert.equal(
    pearson([
      [1, 2],
      [2, 4],
      [3, 6],
    ]),
    1,
  );
  assert.equal(
    pearson([
      [1, 6],
      [2, 4],
      [3, 2],
    ]),
    -1,
  );
  assert.equal(
    pearson([
      [1, 2],
      [1, 3],
      [1, 4],
    ]),
    null,
  );
  assert.equal(
    pearson([
      [1, 2],
      [2, 4],
    ]),
    null,
  );
});
test("session relationship joins after-midnight matches to the right day", () => {
  const d = day("d", "2026-09-13", { sleepHours: 8, warmup: true });
  const data: AppData = {
    dailyLogs: [d],
    sessions: [
      {
        id: "s1",
        dailyLogId: "d",
        name: "Evening",
        startedAt: "2026-09-13T20:00:00Z",
        createdAt: "",
        notes: null,
      },
      {
        id: "s2",
        dailyLogId: "d",
        name: "Late",
        startedAt: "2026-09-13T22:00:00Z",
        createdAt: "",
        notes: null,
      },
    ],
    matches: [
      match("m1", "s1", { adr: 50 }),
      match("m2", "s2", { adr: 100, playedAt: "2026-09-14T01:00:00Z" }),
    ],
  };
  assert.equal(dailyRows(data)[0].adr, 75);
  assert.equal(correlation(data, "sleepHours").n, 1);
  assert.equal(compareHabit(data, "warmup")[0].matches, 2);
  assert.equal(compareHabit(data, "warmup")[1].days, 0);
});
