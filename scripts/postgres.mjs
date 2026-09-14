import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const data = path.join(root, ".data", "postgres");
const bin =
  process.env.PG_BIN ??
  (process.platform === "win32" ? "C:/Program Files/PostgreSQL/18/bin" : "");
const executable = (name) =>
  bin
    ? path.join(bin, name + (process.platform === "win32" ? ".exe" : ""))
    : name;
function run(name, args, required = true) {
  const result = spawnSync(executable(name), args, {
    encoding: "utf8",
    windowsHide: true,
    stdio: name === "pg_ctl" ? "ignore" : "pipe",
  });
  if (required && result.status !== 0) {
    console.error(
      result.stderr ||
        result.error?.message ||
        result.stdout ||
        `${name} failed`,
    );
    process.exit(1);
  }
  return result;
}
const command = process.argv[2] ?? "start";
if (!["start", "stop"].includes(command)) throw new Error("Use start or stop.");
if (command === "stop") {
  if (fs.existsSync(path.join(data, "PG_VERSION")))
    run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  process.exit(0);
}
fs.mkdirSync(path.join(root, ".data"), { recursive: true });
if (!fs.existsSync(path.join(data, "PG_VERSION"))) {
  run("initdb", [
    "-D",
    data,
    "--username=mindcheck",
    "--auth=trust",
    "--encoding=UTF8",
    "--locale=C",
  ]);
  fs.appendFileSync(
    path.join(data, "postgresql.conf"),
    "\nlisten_addresses = '127.0.0.1'\nport = 55432\n",
  );
}
if (run("pg_ctl", ["-D", data, "status"], false).status !== 0)
  run("pg_ctl", [
    "-D",
    data,
    "-l",
    path.join(root, ".data", "postgres.log"),
    "-w",
    "start",
  ]);
const exists = run("psql", [
  "-h",
  "127.0.0.1",
  "-p",
  "55432",
  "-U",
  "mindcheck",
  "-d",
  "postgres",
  "-tAc",
  "SELECT 1 FROM pg_database WHERE datname='mindcheck'",
]);
if (exists.stdout.trim() !== "1")
  run("createdb", [
    "-h",
    "127.0.0.1",
    "-p",
    "55432",
    "-U",
    "mindcheck",
    "mindcheck",
  ]);
if (!fs.existsSync(path.join(root, ".env")))
  fs.copyFileSync(path.join(root, ".env.example"), path.join(root, ".env"));
console.log(
  "Mindcheck PostgreSQL is running on 127.0.0.1:55432. Data: .data/postgres",
);
