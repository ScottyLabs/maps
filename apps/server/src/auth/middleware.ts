import { Elysia } from "elysia";
import { createBearerVerifier } from "./bearer.ts";
import { loadOidcSettings } from "./oidc.ts";
import { getSessionUser, SESSION_COOKIE_NAME } from "./session.ts";

export interface Principal {
  subject: string;
  name: string;
  andrewId: string;
  groups: string[];
  userId: number | null;
}

export type AuthKind = "user" | "member" | "admin";

const ignoreLogin = Deno.env.get("IGNORE_LOGIN") === "true";
const projectGroup = Deno.env.get("PROJECT_GROUP");
const projectAdminGroup = Deno.env.get("PROJECT_ADMIN_GROUP");

const oidcSettings = loadOidcSettings();
const verifyBearer = oidcSettings ? createBearerVerifier(oidcSettings) : undefined;

const devPrincipal: Principal = {
  andrewId: "dev-user",
  groups: [projectAdminGroup, projectGroup].filter((g): g is string => typeof g === "string"),
  name: "Dev User",
  subject: "dev-user",
  userId: null,
};

export function isAdmin(user: Principal): boolean {
  return projectAdminGroup !== undefined && user.groups.includes(projectAdminGroup);
}

export function isMember(user: Principal): boolean {
  return isAdmin(user) || (projectGroup !== undefined && user.groups.includes(projectGroup));
}

export async function principalFrom(
  sessionId: string | undefined,
  authorization: string | undefined,
): Promise<Principal | undefined> {
  if (ignoreLogin) {
    return devPrincipal;
  }

  const bearer = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
  if (bearer) {
    const claims = await verifyBearer?.(bearer);
    return claims ? { ...claims, userId: null } : undefined;
  }

  if (!sessionId) {
    return undefined;
  }

  const session = await getSessionUser(sessionId);
  return session
    ? {
        andrewId: session.andrewId,
        groups: session.groups,
        name: session.name,
        subject: session.oidcSubject,
        userId: session.id,
      }
    : undefined;
}

export const authPlugin = new Elysia({ name: "auth" })
  .macro({
    auth: (kind: AuthKind) => ({
      async resolve({ cookie, headers, status }) {
        const user = await principalFrom(
          cookie[SESSION_COOKIE_NAME]?.value as string | undefined,
          headers["authorization"],
        );

        if (!user) {
          return status(401, { error: "Unauthorized" });
        }
        if (
          !ignoreLogin &&
          ((kind === "member" && !isMember(user)) || (kind === "admin" && !isAdmin(user)))
        ) {
          return status(403, {
            error: "Insufficient permissions to access this resource.",
          });
        }

        return { user };
      },
    }),
    optionalAuth: (enabled: boolean) => ({
      async resolve({ cookie, headers }) {
        return {
          user: enabled
            ? await principalFrom(
                cookie[SESSION_COOKIE_NAME]?.value as string | undefined,
                headers["authorization"],
              )
            : undefined,
        };
      },
    }),
  })
  .as("scoped");
