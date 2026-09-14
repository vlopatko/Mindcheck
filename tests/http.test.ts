import test from "node:test";
import assert from "node:assert/strict";
import { writeGuard } from "../lib/http";
test("Next internal localhost URL can differ from the actual request Host", () => {
  const request = new Request("http://localhost:5173/api/matches", {
    method: "POST",
    headers: {
      host: "127.0.0.1:5173",
      origin: "http://127.0.0.1:5173",
      "content-type": "application/json",
    },
  });
  assert.equal(writeGuard(request), null);
});
test("cross-origin and non-JSON writes are rejected", () => {
  assert.equal(
    writeGuard(
      new Request("http://localhost:5173/api/matches", {
        method: "POST",
        headers: {
          origin: "https://other.example",
          "content-type": "application/json",
        },
      }),
    )?.status,
    403,
  );
  assert.equal(
    writeGuard(
      new Request("http://localhost:5173/api/matches", { method: "POST" }),
    )?.status,
    415,
  );
});
