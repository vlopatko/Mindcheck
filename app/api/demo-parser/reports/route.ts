import { currentUser, unauthorized } from "@/lib/auth";
import { deleteReport, listReports, readReport } from "@/lib/demo-parser/store";
import { writeGuard } from "@/lib/http";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const report = await readReport(user.id, id);
    return report ? Response.json(report) : Response.json({ error: "Report not found." }, { status: 404 });
  }
  const reports = await listReports(user.id);
  const sourceMatchIds = reports
    .map((report) => report.sourceMatchId)
    .filter((id): id is string => Boolean(id));
  const matches = sourceMatchIds.length
    ? await prisma.match.findMany({
        where: {
          id: { in: sourceMatchIds },
          session: { dailyLog: { userId: user.id } },
        },
        select: { id: true, playedAt: true },
      })
    : [];
  const playedAt = new Map(matches.map((match) => [match.id, match.playedAt.toISOString()]));
  const summaries = reports.map((report) => ({
    id: report.id,
    createdAt: report.createdAt,
    playedAt: report.sourceMatchId ? playedAt.get(report.sourceMatchId) ?? null : null,
    map: report.map,
    score: report.score,
    impact: report.impact,
    metrics: {
      kills: report.metrics.kills,
      deaths: report.metrics.deaths,
      assists: report.metrics.assists,
      kd: report.metrics.kd,
      adr: report.metrics.adr,
    },
    source: report.source,
    sourceMatchId: report.sourceMatchId,
  })).sort((a, b) =>
    (b.playedAt ?? b.createdAt).localeCompare(a.playedAt ?? a.createdAt) ||
    b.createdAt.localeCompare(a.createdAt),
  );
  return Response.json({
    reports: summaries,
  });
}

export async function DELETE(request: Request) {
  const guard = writeGuard(request);
  if (guard) return guard;
  const user = await currentUser();
  if (!user) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return Response.json({ error: "Report id is required." }, { status: 400 });
  try {
    const deleted = await deleteReport(user.id, id);
    return deleted
      ? Response.json({ deleted: true })
      : Response.json({ error: "Report not found." }, { status: 404 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Report could not be deleted." },
      { status: 400 },
    );
  }
}
