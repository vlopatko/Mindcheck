import { prisma } from "@/lib/prisma";
import { matchSchema } from "@/lib/validation";
import { MatchInput } from "@/lib/model";
import { writeGuard, invalid, storageError } from "@/lib/http";
import { currentUser, unauthorized } from "@/lib/auth";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  const guard = writeGuard(request);
  if (guard) return guard;
  const user = await currentUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const parsed = matchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const input = parsed.data as MatchInput;
  try {
    if (!(await prisma.match.findFirst({ where: { id, session: { dailyLog: { userId: user.id } } } })))
      return Response.json({ error: "Match not found." }, { status: 404 });
    if (!(await prisma.session.findFirst({ where: { id: input.sessionId, dailyLog: { userId: user.id } } })))
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
  const user = await currentUser();
  if (!user) return unauthorized();
  try {
    const { id } = await context.params;
    await prisma.match.deleteMany({ where: { id, session: { dailyLog: { userId: user.id } } } });
    return Response.json({ ok: true });
  } catch (e) {
    return storageError(e);
  }
}
