import { prisma } from "@/lib/prisma";
import { dailySchema } from "@/lib/validation";
import { DailyInput, hasCheckin } from "@/lib/model";
import { writeGuard, invalid, storageError } from "@/lib/http";
export async function PUT(request: Request) {
  const guard = writeGuard(request);
  if (guard) return guard;
  const body = await request.json().catch(() => null);
  const parsed = dailySchema.safeParse(body);
  if (!parsed.success) return invalid();
  const input = parsed.data as DailyInput;
  const { date, ...state } = input;
  try {
    const checkedInAt = hasCheckin(input) ? new Date() : null;
    const row = await prisma.dailyLog.upsert({
      where: { date: new Date(date + "T00:00:00Z") },
      create: { ...state, date: new Date(date + "T00:00:00Z"), checkedInAt },
      update: { ...state, checkedInAt },
    });
    return Response.json({ id: row.id });
  } catch (e) {
    return storageError(e);
  }
}
