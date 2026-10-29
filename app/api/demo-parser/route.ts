import { currentUser, unauthorized } from "@/lib/auth";
import { analyzeDemo, inspectDemo } from "@/lib/demo-parser/parser";
import { saveReport } from "@/lib/demo-parser/store";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_DEMO_BYTES = 1_000_000_000;

export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return unauthorized();
  try {
    const form = await request.formData();
    const file = form.get("demo");
    const mode = form.get("mode");
    if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".dem"))
      return Response.json({ error: "Choose a Counter-Strike 2 .dem file." }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_DEMO_BYTES)
      return Response.json({ error: "The demo is empty or larger than the 1 GB local limit." }, { status: 413 });
    const buffer = Buffer.from(await file.arrayBuffer());
    if (mode === "inspect") return Response.json(inspectDemo(buffer));
    const selectedSteamId = String(form.get("steamId64") ?? "");
    if (selectedSteamId !== user.steamId)
      return Response.json({ error: "You can create a personal report only for the authenticated Mindcheck SteamID64." }, { status: 403 });
    const report = analyzeDemo(buffer, selectedSteamId);
    await saveReport(user.id, report);
    return Response.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The demo could not be parsed.";
    return Response.json({ error: message, partial: false }, { status: 422 });
  }
}

