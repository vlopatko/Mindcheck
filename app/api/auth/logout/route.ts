import { destroyLoginSession } from "@/lib/auth";
import { writeGuard } from "@/lib/http";

export async function POST(request: Request) {
  const guard = writeGuard(request);
  if (guard) return guard;
  await destroyLoginSession();
  return Response.json({ ok: true });
}
