import { prisma } from "@/lib/prisma";
import { sessionSchema } from "@/lib/validation";
import { writeGuard, invalid, storageError } from "@/lib/http";
import { currentUser, unauthorized } from "@/lib/auth";
export async function POST(request: Request) {
  const guard = writeGuard(request);
  if (guard) return guard;
  const user = await currentUser();
  if (!user) return unauthorized();
  const parsed = sessionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) return invalid();
  const { date, ...input } = parsed.data;
  try {
    const session = await prisma.$transaction(async (tx) => {
      const day = await tx.dailyLog.upsert({
        where: { userId_date: { userId: user.id, date: new Date(date + "T00:00:00Z") } },
        create: { date: new Date(date + "T00:00:00Z"), userId: user.id },
        update: {},
      });
      return tx.session.create({
        data: {
          ...input,
          startedAt: new Date(input.startedAt),
          dailyLogId: day.id,
        },
      });
    });
    return Response.json(session, { status: 201 });
  } catch (e) {
    return storageError(e);
  }
}
