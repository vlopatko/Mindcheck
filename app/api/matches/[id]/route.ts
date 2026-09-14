import { prisma } from "@/lib/prisma";
import { matchSchema } from "@/lib/validation";
import { MatchInput } from "@/lib/model";
import { writeGuard, invalid, storageError } from "@/lib/http";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  const guard = writeGuard(request);
  if (guard) return guard;
  const { id } = await context.params;
  const parsed = matchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const input = parsed.data as MatchInput;
  try {
    if (!(await prisma.match.findUnique({ where: { id } })))
      return Response.json({ error: "Match not found." }, { status: 404 });
    if (!(await prisma.session.findUnique({ where: { id: input.sessionId } })))
      return Response.json({ error: "Session not found." }, { status: 404 });
    const match = await prisma.match.update({
      where: { id },
      data: { ...input, playedAt: new Date(input.playedAt) },
    });
    return Response.json(match);
  } catch (e) {
    return storageError(e);
  }
}
export async function DELETE(request: Request, context: Context) {
  const guard = writeGuard(request);
  if (guard) return guard;
  try {
    const { id } = await context.params;
    await prisma.match.deleteMany({ where: { id } });
    return Response.json({ ok: true });
  } catch (e) {
    return storageError(e);
  }
}
