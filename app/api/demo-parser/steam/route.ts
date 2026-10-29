import { Readable } from "node:stream";
import { currentUser, unauthorized } from "@/lib/auth";
import { analyzeDemo } from "@/lib/demo-parser/parser";
import { listReports, saveReport } from "@/lib/demo-parser/store";
import { prisma } from "@/lib/prisma";
import unbzip2Stream from "unbzip2-stream";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_DEMO_BYTES = 1_000_000_000;

async function downloadDemo(url: string) {
  const parsed = new URL(url);
  const trustedHost = parsed.hostname === "valve.net" || parsed.hostname.endsWith(".valve.net");
  if (!trustedHost || !["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password)
    throw new Error("Steam demo URL does not point to a trusted Valve replay host.");
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok || !response.body) throw new Error(`Demo download failed (${response.status}).`);
  if (!/\.bz2(?:\?|$)/i.test(parsed.pathname + parsed.search)) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_DEMO_BYTES) throw new Error("Demo exceeds the 1 GB local limit.");
    return buffer;
  }
  const source = Readable.fromWeb(response.body as never);
  const decoder = unbzip2Stream();
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      source.destroy();
      decoder.destroy();
      if (error) reject(error);
      else resolve(Buffer.concat(chunks, length));
    };
    decoder.on("data", (chunk: Buffer | Uint8Array) => {
      const buffer = Buffer.from(chunk);
      length += buffer.length;
      if (length > MAX_DEMO_BYTES) {
        finish(new Error("Decompressed demo exceeds the 1 GB local limit."));
        return;
      }
      chunks.push(buffer);
    });
    decoder.once("end", () => finish());
    decoder.once("error", (error: Error) => finish(error));
    source.once("error", (error: Error) => finish(error));
    source.pipe(decoder);
  });
}

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  const [matches, reports] = await Promise.all([
    prisma.match.findMany({
      where: { demoUrl: { not: null }, session: { dailyLog: { userId: user.id } } },
      orderBy: { playedAt: "desc" },
      take: 30,
      select: { id: true, playedAt: true, map: true, teamScore: true, enemyScore: true },
    }),
    listReports(user.id),
  ]);
  const parsedIds = new Set(reports.map((report) => report.sourceMatchId).filter(Boolean));
  return Response.json({ matches: matches.filter((match) => !parsedIds.has(match.id)) });
}

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const input = await request.json().catch(() => null) as { matchId?: unknown } | null;
  if (!input || typeof input.matchId !== "string")
    return Response.json({ error: "matchId is required." }, { status: 400 });
  const match = await prisma.match.findFirst({
    where: { id: input.matchId, demoUrl: { not: null }, session: { dailyLog: { userId: user.id } } },
    select: { id: true, demoUrl: true },
  });
  if (!match?.demoUrl) return Response.json({ error: "Steam demo is not available for this match." }, { status: 404 });
  try {
    const buffer = await downloadDemo(match.demoUrl);
    const report = analyzeDemo(buffer, user.steamId, "steam", match.id);
    await saveReport(user.id, report);
    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Steam demo analysis failed." }, { status: 422 });
  }
}
