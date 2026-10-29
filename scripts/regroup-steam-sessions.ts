import "dotenv/config";
import { prisma } from "../lib/prisma";
import {
  automaticSessionName,
  SESSION_GAP_MS,
  sessionDateKey,
  sessionPeriod,
} from "../lib/session-naming";

const automaticName = /^(?:Steam session|\d{4}-\d{2}-\d{2}-(?:day|night)-Session\d+|\d{2}-\d{2}-\d{4}_(?:day|night)_\d+)$/;

async function main() {
  const users = await prisma.steamUser.findMany({ select: { id: true } });
  let renamed = 0;
  let reassigned = 0;
  let removed = 0;

  for (const user of users) {
    const imported = (await prisma.match.findMany({
      where: {
        steamMatchId: { not: null },
        session: { dailyLog: { userId: user.id } },
      },
      orderBy: { playedAt: "asc" },
      select: {
        id: true,
        playedAt: true,
        sessionId: true,
        session: { select: { name: true } },
      },
    })).filter((match) => automaticName.test(match.session.name));

    const groups: typeof imported[] = [];
    for (const match of imported) {
      const current = groups.at(-1);
      const previous = current?.at(-1);
      if (!previous || match.playedAt.getTime() - previous.playedAt.getTime() > SESSION_GAP_MS)
        groups.push([match]);
      else current.push(match);
    }

    await prisma.$transaction(async (tx) => {
      const originalSessionIds = [...new Set(imported.map((match) => match.sessionId))];
      const usedSessionIds = new Set<string>();
      const counters = new Map<string, number>();

      for (const group of groups) {
        const first = group[0];
        const dateKey = sessionDateKey(first.playedAt);
        const period = sessionPeriod(first.playedAt);
        const counterKey = `${dateKey}:${period}`;
        const sessionNumber = (counters.get(counterKey) ?? 0) + 1;
        counters.set(counterKey, sessionNumber);
        const day = await tx.dailyLog.upsert({
          where: { userId_date: { userId: user.id, date: new Date(`${dateKey}T00:00:00Z`) } },
          create: { userId: user.id, date: new Date(`${dateKey}T00:00:00Z`) },
          update: {},
        });
        let targetSessionId = group.map((match) => match.sessionId).find((id) => !usedSessionIds.has(id));
        if (targetSessionId) {
          await tx.session.update({
            where: { id: targetSessionId },
            data: {
              dailyLogId: day.id,
              startedAt: first.playedAt,
              name: automaticSessionName(first.playedAt, sessionNumber),
            },
          });
          renamed++;
        } else {
          const session = await tx.session.create({
            data: {
              dailyLogId: day.id,
              startedAt: first.playedAt,
              name: automaticSessionName(first.playedAt, sessionNumber),
            },
          });
          targetSessionId = session.id;
        }
        usedSessionIds.add(targetSessionId);
        const result = await tx.match.updateMany({
          where: { id: { in: group.map((match) => match.id) } },
          data: { sessionId: targetSessionId },
        });
        reassigned += result.count;
      }

      for (const sessionId of originalSessionIds.filter((id) => !usedSessionIds.has(id))) {
        if (await tx.match.count({ where: { sessionId } })) continue;
        await tx.session.delete({ where: { id: sessionId } });
        removed++;
      }
    });
  }

  console.log(`Regrouped ${reassigned} match(es), renamed ${renamed} session(s), removed ${removed} empty automatic session(s).`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

