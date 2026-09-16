import { z } from "zod";
import { currentUser, unauthorized } from "@/lib/auth";
import { writeGuard } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { fetchMatchDetails, sharingCodes } from "@/lib/steam-import";
import { decryptSecret, encryptSecret } from "@/lib/secret";

export const runtime = "nodejs";

const inputSchema = z.object({
  authCode: z.string().trim().min(1).max(100).optional(),
  shareCode: z.string().trim().regex(/^CSGO(?:-[A-Za-z0-9]{5}){5}$/).optional(),
});

export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  return Response.json({
    configured: Boolean(user.matchAuthCodeEncrypted && user.lastShareCode),
  });
}

export async function POST(request: Request) {
  const guard = writeGuard(request);
  if (guard) return guard;
  const user = await currentUser();
  if (!user) return unauthorized();
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ error: "Enter a valid authentication code and CS2 sharing code." }, { status: 400 });

  try {
    const authCode = parsed.data.authCode ??
      (user.matchAuthCodeEncrypted ? decryptSecret(user.matchAuthCodeEncrypted) : null);
    const firstCode = parsed.data.shareCode ?? user.lastShareCode;
    if (!authCode || !firstCode)
      return Response.json(
        { error: "Connect Steam match history once before syncing." },
        { status: 400 },
      );
    const codes = await sharingCodes(user.steamId, authCode, firstCode);
    const details = (await fetchMatchDetails(user.steamId, codes))
      .filter((match) => match.steamMatchId && !Number.isNaN(+match.playedAt))
      .sort((a, b) => +a.playedAt - +b.playedAt)
      .slice(-10);
    let imported = 0;
    let previousTime: Date | null = null;
    let sessionId: string | null = null;

    await prisma.$transaction(async (tx) => {
      for (const match of details) {
        const existing = await tx.match.findFirst({
          where: { steamMatchId: match.steamMatchId, session: { dailyLog: { userId: user.id } } },
        });
        if (existing) {
          await tx.match.update({
            where: { id: existing.id },
            data: {
              playedAt: match.playedAt,
              map: match.map,
              result: match.result,
              teamScore: match.teamScore,
              enemyScore: match.enemyScore,
              kills: match.kills,
              deaths: match.deaths,
              assists: match.assists,
              headshot: match.headshot,
              shareCode: match.shareCode ?? existing.shareCode,
              demoUrl: match.demoUrl,
            },
          });
          previousTime = match.playedAt;
          sessionId = existing.sessionId;
          continue;
        }
        if (!previousTime || match.playedAt.getTime() - previousTime.getTime() > 3_600_000) {
          const date = new Date(`${match.playedAt.toISOString().slice(0, 10)}T00:00:00Z`);
          const day = await tx.dailyLog.upsert({
            where: { userId_date: { userId: user.id, date } },
            create: { userId: user.id, date },
            update: {},
          });
          const session = await tx.session.create({
            data: { dailyLogId: day.id, startedAt: match.playedAt, name: "Steam session" },
          });
          sessionId = session.id;
        }
        await tx.match.create({
          data: {
            sessionId: sessionId!,
            playedAt: match.playedAt,
            platform: "VALVE",
            map: match.map,
            result: match.result,
            teamScore: match.teamScore,
            enemyScore: match.enemyScore,
            kills: match.kills,
            deaths: match.deaths,
            assists: match.assists,
            headshot: match.headshot,
            steamMatchId: match.steamMatchId,
            shareCode: match.shareCode,
            demoUrl: match.demoUrl,
          },
        });
        imported++;
        previousTime = match.playedAt;
      }
      await tx.steamUser.update({
        where: { id: user.id },
        data: {
          lastShareCode: codes.at(-1),
          ...(parsed.data.authCode
            ? { matchAuthCodeEncrypted: encryptSecret(parsed.data.authCode) }
            : {}),
        },
      });
    });
    return Response.json({ imported, found: details.length });
  } catch (error) {
    console.error("Steam import failed:", error instanceof Error ? error.message : error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Steam import failed." },
      { status: 502 },
    );
  }
}
