import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const envPath = new URL("../.env", import.meta.url);
const current = await readFile(envPath, "utf8");
if (/^STEAM_CREDENTIAL_SECRET="?.+"?$/m.test(current)) {
  console.log("STEAM_CREDENTIAL_SECRET is already configured.");
} else {
  const line = `STEAM_CREDENTIAL_SECRET="${randomBytes(32).toString("base64url")}"`;
  const next = /^STEAM_CREDENTIAL_SECRET=.*$/m.test(current)
    ? current.replace(/^STEAM_CREDENTIAL_SECRET=.*$/m, line)
    : `${current.trimEnd()}\n${line}\n`;
  await writeFile(envPath, next, "utf8");
  console.log("STEAM_CREDENTIAL_SECRET generated and saved to .env.");
}
