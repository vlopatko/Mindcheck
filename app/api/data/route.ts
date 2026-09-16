import { prisma } from "@/lib/prisma";
import { storageError } from "@/lib/http";
import { currentUser, unauthorized } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const user = await currentUser();
  if (!user) return unauthorized();
  try {
    const [dailyLogs, sessions, matches] = await prisma.$transaction([
      prisma.dailyLog.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
      prisma.session.findMany({ where: { dailyLog: { userId: user.id } }, orderBy: { startedAt: "desc" } }),
      prisma.match.findMany({ where: { session: { dailyLog: { userId: user.id } } }, orderBy: { playedAt: "desc" } }),
    ]);
    return Response.json(
      {
        dailyLogs: dailyLogs.map((d) => ({
          ...d,
          date: d.date.toISOString().slice(0, 10),
          notes: d.notes ?? "",
        })),
        sessions,
        matches: matches.map((m) => ({
          ...m,
          map: m.map ?? "",
          notes: m.notes ?? "",
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return storageError(e);
  }
}
