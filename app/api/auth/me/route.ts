import { currentUser } from "@/lib/auth";

export async function GET() {
  const user = await currentUser();
  return Response.json(
    user
      ? { authenticated: true, steamId: user.steamId, displayName: user.displayName, avatarUrl: user.avatarUrl }
      : { authenticated: false },
    { headers: { "Cache-Control": "no-store" } },
  );
}
