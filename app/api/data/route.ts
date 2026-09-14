import { prisma } from "@/lib/prisma";
import { storageError } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const [dailyLogs, sessions, matches] = await prisma.$transaction([
      prisma.dailyLog.findMany({ orderBy: { date: "desc" } }),
      prisma.session.findMany({ orderBy: { startedAt: "desc" } }),
      prisma.match.findMany({ orderBy: { playedAt: "desc" } }),
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
