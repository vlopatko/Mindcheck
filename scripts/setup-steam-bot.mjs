import { readFile, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { EAuthTokenPlatformType, LoginSession } from "steam-session";

const envPath = new URL("../.env", import.meta.url);
const qrPath = new URL("./steam-login-qr.svg", import.meta.url);
const require = createRequire(import.meta.url);
const QRCode = require("qrcode-terminal/vendor/QRCode");
const QRErrorCorrectLevel = require("qrcode-terminal/vendor/QRCode/QRErrorCorrectLevel");
const session = new LoginSession(EAuthTokenPlatformType.SteamClient, {
  machineFriendlyName: "Mindcheck CS2 importer",
});
session.loginTimeout = 300_000;

session.on("authenticated", async () => {
  const token = session.refreshToken;
  if (!token) {
    console.error("Steam authenticated, but no refresh token was returned.");
    process.exitCode = 1;
    return;
  }
  const current = await readFile(envPath, "utf8");
  const line = `STEAM_BOT_REFRESH_TOKEN="${token}"`;
  const next = /^STEAM_BOT_REFRESH_TOKEN=.*$/m.test(current)
    ? current.replace(/^STEAM_BOT_REFRESH_TOKEN=.*$/m, line)
    : `${current.trimEnd()}\n${line}\n`;
  await writeFile(envPath, next, "utf8");
  await unlink(qrPath).catch(() => {});
  console.log("Steam bot refresh token saved to .env. You can close this terminal.");
});

session.on("error", (error) => {
  console.error(`Steam login failed: ${error.message}`);
  process.exitCode = 1;
});

session.on("timeout", () => {
  console.error("Steam QR login timed out. Run npm run steam:setup-bot again.");
  process.exitCode = 1;
});

const { qrChallengeUrl } = await session.startWithQR();
const qr = new QRCode(-1, QRErrorCorrectLevel.L);
qr.addData(qrChallengeUrl);
qr.make();
const scale = 10;
const quiet = 4;
const size = (qr.getModuleCount() + quiet * 2) * scale;
const cells = [];
for (let row = 0; row < qr.getModuleCount(); row++)
  for (let column = 0; column < qr.getModuleCount(); column++)
    if (qr.isDark(row, column))
      cells.push(`<rect x="${(column + quiet) * scale}" y="${(row + quiet) * scale}" width="${scale}" height="${scale}"/>`);
await writeFile(
  qrPath,
  `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="100%" height="100%" fill="white"/><g fill="black">${cells.join("")}</g></svg>`,
  "utf8",
);
console.log("QR image created at scripts/steam-login-qr.svg. Scan it in Steam Mobile and approve the login.");
