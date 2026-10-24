import { createRemoteJWKSet, jwtVerify } from "jose";
import { issuerUrl, type OidcSettings } from "./oidc.ts";

export interface BearerClaims {
  subject: string;
  name: string;
  andrewId: string;
  groups: string[];
}

export function createBearerVerifier(settings: OidcSettings) {
  const issuer = issuerUrl(settings).href;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));

  return async (token: string): Promise<BearerClaims | undefined> => {
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer });
      const groups = Array.isArray(payload["groups"])
        ? payload["groups"].filter((g): g is string => typeof g === "string")
        : [];
      const preferredUsername =
        typeof payload["preferred_username"] === "string"
          ? payload["preferred_username"]
          : undefined;
      const subject = payload.sub ?? "unknown";

      return {
        andrewId: preferredUsername ?? subject,
        groups,
        name:
          typeof payload["name"] === "string" ? payload["name"] : (preferredUsername ?? subject),
        subject,
      };
    } catch {
      return undefined;
    }
  };
}
