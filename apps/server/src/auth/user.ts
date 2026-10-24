import type { IDToken } from "@panva/openid-client";
import { prisma } from "../../prisma/index.ts";

export function claimedGroups(claims: IDToken): string[] {
  const groups = claims["groups"];
  return Array.isArray(groups)
    ? groups.filter((group): group is string => typeof group === "string")
    : [];
}

export async function getOrCreateUser(claims: IDToken) {
  const preferredUsername =
    typeof claims.preferred_username === "string" ? claims.preferred_username : undefined;
  const email = typeof claims.email === "string" ? claims.email : undefined;
  const andrewId = preferredUsername ?? email?.split("@")[0] ?? claims.sub;
  const name = typeof claims.name === "string" ? claims.name : (preferredUsername ?? andrewId);

  return await prisma.user.upsert({
    create: { andrewId, name, oidcSubject: claims.sub },
    update: { andrewId, name },
    where: { oidcSubject: claims.sub },
  });
}
