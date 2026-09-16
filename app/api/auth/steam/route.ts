import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { OPENID_STATE_COOKIE, publicOrigin } from "@/lib/auth";

export async function GET(request: Request) {
  const origin = publicOrigin(request);
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(OPENID_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  const callback = `${origin}/api/auth/steam/callback?state=${encodeURIComponent(state)}`;
  const params = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": callback,
    "openid.realm": origin,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  });
  return Response.redirect(`https://steamcommunity.com/openid/login?${params}`);
}
