import { prisma } from "@/lib/prisma";
import { dailySchema } from "@/lib/validation";
import { DailyInput, hasCheckin } from "@/lib/model";
import { writeGuard, invalid, storageError } from "@/lib/http";
import { currentUser, unauthorized } from "@/lib/auth";
export async function PUT(request: Request) {
  const guard = writeGuard(request);
  if (guard) return guard;
  const user = await currentUser();
  if (!user) return unauthorized();
  const body = await request.json().catch(() => null);
  const parsed = dailySchema.safeParse(body);
  if (!parsed.success) return invalid();
  const input = parsed.data as DailyInput;
  const { date, ...state } = input;
  try {
    const checkedInAt = hasCheckin(input) ? new Date() : null;
    const row = await prisma.dailyLog.upsert({
      where: { userId_date: { userId: user.id, date: new Date(date + "T00:00:00Z") } },
      create: { ...state, userId: user.id, date: new Date(date + "T00:00:00Z"), checkedInAt },
      update: { ...state, checkedInAt },
    });
    return Response.json({ id: row.id });
  } catch (e) {
    return storageError(e);
  }
}
