import { prisma } from "@/lib/prisma";
import { matchSchema } from "@/lib/validation";
import { MatchInput } from "@/lib/model";
import { writeGuard, invalid, storageError } from "@/lib/http";
import { currentUser, unauthorized } from "@/lib/auth";
export async function POST(request: Request) {
  const guard = writeGuard(request);
  if (guard) return guard;
  const user = await currentUser();
  if (!user) return unauthorized();
  const parsed = matchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return invalid();
  const input = parsed.data as MatchInput;
  try {
    if (!(await prisma.session.findFirst({ where: { id: input.sessionId, dailyLog: { userId: user.id } } })))
      return Response.json(
        { error: "Choose an existing session first." },
        { status: 404 },
      );
    const match = await prisma.match.create({
      data: { ...input, playedAt: new Date(input.playedAt) },
    });
    return Response.json(match, { status: 201 });
  } catch (e) {
    return storageError(e);
  }
}
