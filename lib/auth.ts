import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "mindcheck_session";
export const OPENID_STATE_COOKIE = "mindcheck_openid_state";
const SESSION_DAYS = 30;

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.steamAuthSession.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date()) return null;
  return session.user;
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

export async function createLoginSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.steamAuthSession.create({
    data: {
      tokenHash: hash(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000),
    },
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroyLoginSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token)
    await prisma.steamAuthSession.deleteMany({
      where: { tokenHash: hash(token) },
    });
  store.delete(SESSION_COOKIE);
}

export function unauthorized() {
  return Response.json({ error: "Sign in with Steam to continue." }, { status: 401 });
}

export function publicOrigin(request: Request) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}
