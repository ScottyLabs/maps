// https://tsoa-community.github.io/docs/authentication.html#authentication
// https://medium.com/@alexandre.penombre/tsoa-the-library-that-will-supercharge-your-apis-c551c8989081

import { fromNodeHeaders } from "better-auth/node";
import type * as express from "express";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { env } from "../env.ts";
import type { HttpError } from "../middleware/errorHandler.ts";
import {
  AuthenticationError,
  AuthorizationError,
  InternalServerError,
} from "../middleware/errorHandler.ts";
import { auth } from "./auth.ts";

export const OIDC_AUTH = "oidc";
export const BEARER_AUTH = "bearerAuth";
export const ADMIN_SCOPE = "cmumaps-admins";
export const MEMBER_SCOPE = "cmumaps-members";

declare module "express" {
  interface Request {
    authErrors?: HttpError[];
  }
}

// TSAO `resolve` will attach the user object to the request object
declare global {
  // biome-ignore lint/style/noNamespace: Express uses global namespace
  namespace Express {
    interface User {
      sub: string;
      email?: string;
      givenName?: string;
      groups?: string[];
    }
  }
}

// Matches paths like /floors/:id/floorplan
const FLOORPLAN_PATH_REGEX = "^/floors/[^/]+/floorplan$";

export function expressAuthentication(
  request: express.Request,
  securityName: string,
  scopes?: string[],
) {
  // Store all authentication errors in the request object so we can return the most relevant error to the client in errorHandler
  request.authErrors = request.authErrors ?? [];

  // biome-ignore lint/nursery/noMisusedPromises: Weird TSOA quirks
  return new Promise((resolve, reject) => {
    if (env.IGNORE_LOGIN) {
      return resolve({ sub: "dev-user", groups: [ADMIN_SCOPE, MEMBER_SCOPE] });
    }

    // Accept any request to view CUC floorplans
    const match = request.path.match(FLOORPLAN_PATH_REGEX);
    if (match && request.params.floorCode.startsWith("CUC")) {
      return resolve({});
    }

    if (securityName === OIDC_AUTH) {
      return validateOidc(request, reject, resolve, scopes);
    }

    if (securityName === BEARER_AUTH) {
      return verifyBearerAuth(request, reject, resolve, scopes);
    }

    const err = new InternalServerError("Invalid security name");
    request.authErrors?.push(err);
    return reject(err);
  });
}

/**
 * Verify OpenID Connect Authentication by checking the user object and scopes
 */
const validateOidc = async (
  request: express.Request,
  reject: (value: unknown) => void,
  resolve: (value: unknown) => void,
  scopes?: string[],
) => {
  // Check if the user is authenticated
  try {
    // https://www.better-auth.com/docs/integrations/express
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    // Check if the user is authenticated
    if (!session?.user) {
      const err = new AuthenticationError();
      request.authErrors?.push(err);
      return reject(err);
    }

    // Get the group from the user access token
    const decoded = await auth.api
      .getAccessToken({
        body: { providerId: "keycloak" },
        headers: fromNodeHeaders(request.headers),
      })
      .then((accessToken) => jwt.decode(accessToken.accessToken));

    // Check if the decoded token is valid
    if (decoded === null || typeof decoded !== "object") {
      const err = new AuthenticationError();
      request.authErrors?.push(err);
      return reject(err);
    }

    // Check if the user has any of the required scopes
    if (!hasAnyScope(decoded["groups"] ?? [], scopes)) {
      return scopeValidationError(request, reject);
    }

    return resolve({ ...decoded });
  } catch (error) {
    console.error("Authentication error:", error);
    const err = new AuthenticationError();
    request.authErrors?.push(err);
    return reject(err);
  }
};

const client = jwksClient({ jwksUri: env.AUTH_JWKS_URI });

/**
 * Verify Bearer Authentication by verifying the token and checking the scopes
 */
const verifyBearerAuth = (
  request: express.Request,
  reject: (value: unknown) => void,
  resolve: (value: unknown) => void,
  scopes?: string[],
) => {
  const token = request.headers.authorization?.split(" ")[1];
  if (!token) {
    const err = new AuthenticationError();
    request.authErrors?.push(err);
    return reject(err);
  }

  jwt.verify(
    token,
    (header, callback) => {
      client.getSigningKey(header.kid, (_error, key) => {
        if (!key) {
          console.error("No key found for kid:", header.kid);
          const err = new AuthenticationError();
          request.authErrors?.push(err);
          return reject(err);
        }

        const signingKey = key.getPublicKey();
        callback(null, signingKey);
      });
    },
    { issuer: env.AUTH_ISSUER, audience: env.AUTH_CLIENT_ID },
    (error, decoded) => {
      // Check if the token is valid
      if (error) {
        console.error("Authentication error:", error.message);
        const err = new AuthenticationError();
        request.authErrors?.push(err);
        return reject(err);
      }

      // Check if the token format is valid
      if (!decoded || typeof decoded !== "object") {
        const err = new AuthenticationError();
        request.authErrors?.push(err);
        return reject(err);
      }

      // Check if the token contains any of the required scopes
      if (!hasAnyScope(decoded["groups"], scopes)) {
        return scopeValidationError(request, reject);
      }

      return resolve({ ...decoded });
    },
  );
};

// Verify if the groups contain ANY of the required scopes
const hasAnyScope = (groups?: string[], scopes?: string[]) => {
  // If no scopes are required, return true
  if (scopes?.length === 0) {
    return true;
  }

  // If no groups are present, return false
  if (groups?.length === 0) {
    return false;
  }

  // Check if any of the groups contain any of the required scopes
  return groups?.some((group) => scopes?.includes(group));
};

const scopeValidationError = (
  request: express.Request,
  reject: (value: unknown) => void,
) => {
  const err = new AuthorizationError(
    "Insufficient permissions to access this resource.",
  );
  request.authErrors?.push(err);
  return reject(err);
};
