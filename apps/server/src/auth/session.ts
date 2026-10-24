import type { CookieOptions } from "elysia";
import { prisma } from "../../prisma/index.ts";

export const SESSION_COOKIE_NAME = "session_id";
export const OAUTH_STATE_COOKIE_NAME = "oauth_state";

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const OAUTH_STATE_DURATION_S = 10 * 60;

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  path: "/",
  sameSite: "lax",
  secure: (Deno.env.get("APP_URL") ?? "").startsWith("https://"),
};

export const sessionCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  maxAge: SESSION_DURATION_MS / 1000,
};

export const oauthStateCookieOptions: CookieOptions = {
  ...baseCookieOptions,
  maxAge: OAUTH_STATE_DURATION_S,
};

export interface SessionUser {
  id: number;
  name: string;
  andrewId: string;
  oidcSubject: string;
  groups: string[];
}

export async function createSession(userId: number, groups: string[]): Promise<string> {
  const id = crypto.randomUUID();
  await prisma.session.create({
    data: {
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
      groups,
      id,
      userId,
    },
  });
  return id;
}

export async function getSessionUser(sessionId: string): Promise<SessionUser | undefined> {
  const session = await prisma.session.findUnique({
    include: { user: true },
    where: { id: sessionId },
  });
  if (!session) {
    return undefined;
  }

  if (session.expiresAt.getTime() < Date.now()) {
    await deleteSession(sessionId);
    return undefined;
  }

  return {
    andrewId: session.user.andrewId,
    groups: session.groups,
    id: session.user.id,
    name: session.user.name,
    oidcSubject: session.user.oidcSubject,
  };
}

export async function deleteSession(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { id: sessionId } });
}
