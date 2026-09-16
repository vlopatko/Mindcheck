import { cookies } from "next/headers";
import { createLoginSession, OPENID_STATE_COOKIE, publicOrigin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const store = await cookies();
  const expectedState = store.get(OPENID_STATE_COOKIE)?.value;
  store.delete(OPENID_STATE_COOKIE);
  if (!expectedState || url.searchParams.get("state") !== expectedState)
    return Response.redirect(`${publicOrigin(request)}/login?error=state`);

  const verify = new URLSearchParams();
  url.searchParams.forEach((value, key) => {
    if (key.startsWith("openid.")) verify.set(key, value);
  });
  verify.set("openid.mode", "check_authentication");
  const response = await fetch("https://steamcommunity.com/openid/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verify,
    cache: "no-store",
  });
  const valid = (await response.text()).includes("is_valid:true");
  const claimed = url.searchParams.get("openid.claimed_id") ?? "";
  const steamId = claimed.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/(\d+)$/)?.[1];
  if (!valid || !steamId)
    return Response.redirect(`${publicOrigin(request)}/login?error=verification`);

  let displayName: string | undefined;
  let avatarUrl: string | undefined;
  const key = process.env.STEAM_WEB_API_KEY;
  if (key) {
    const profileResponse = await fetch(
      `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${encodeURIComponent(key)}&steamids=${steamId}`,
      { cache: "no-store" },
    );
    if (profileResponse.ok) {
      const profile = (await profileResponse.json()).response?.players?.[0];
      displayName = profile?.personaname;
      avatarUrl = profile?.avatarfull;
    }
  }
  const user = await prisma.steamUser.upsert({
    where: { steamId },
    create: { steamId, displayName, avatarUrl },
    update: { displayName, avatarUrl },
  });
  const otherUsers = await prisma.steamUser.count({ where: { id: { not: user.id } } });
  if (otherUsers === 0)
    await prisma.dailyLog.updateMany({ where: { userId: null }, data: { userId: user.id } });
  await createLoginSession(user.id);
  return Response.redirect(`${publicOrigin(request)}/matches`);
}
