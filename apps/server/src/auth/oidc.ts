import * as client from "@panva/openid-client";

export interface OidcSettings {
  clientId: string;
  clientSecret: string;
  keycloakUrl: string;
  keycloakRealm: string;
  oauthRelayUrl: string;
}

export function loadOidcSettings(): OidcSettings | undefined {
  const clientId = Deno.env.get("OIDC_CLIENT_ID");
  const clientSecret = Deno.env.get("OIDC_CLIENT_SECRET");
  const keycloakUrl = Deno.env.get("KEYCLOAK_URL");
  const keycloakRealm = Deno.env.get("KEYCLOAK_REALM");
  const oauthRelayUrl = Deno.env.get("OAUTH_RELAY_URL");

  if (!clientId || !clientSecret || !keycloakUrl || !keycloakRealm || !oauthRelayUrl) {
    return undefined;
  }

  return { clientId, clientSecret, keycloakRealm, keycloakUrl, oauthRelayUrl };
}

export function issuerUrl(settings: OidcSettings): URL {
  return new URL(`${settings.keycloakUrl.replace(/\/$/u, "")}/realms/${settings.keycloakRealm}`);
}

export async function buildOidcConfig(settings: OidcSettings): Promise<client.Configuration> {
  const config = await client.discovery(
    issuerUrl(settings),
    settings.clientId,
    settings.clientSecret,
  );

  // Keycloak sees the relay as the redirect target, so the code exchange has to claim the same URI the authorization request used.
  config[client.customFetch] = (url, options) => {
    if (
      options.body instanceof URLSearchParams &&
      options.body.get("grant_type") === "authorization_code"
    ) {
      options.body.set("redirect_uri", settings.oauthRelayUrl);
    }

    return fetch(url, options as RequestInit);
  };

  return config;
}

interface RelayState {
  return_to: string;
  csrf: string;
}

export function createRelayState(returnTo: string): string {
  const payload: RelayState = { csrf: crypto.randomUUID(), return_to: returnTo };

  return btoa(JSON.stringify(payload))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export async function buildLoginUrl(
  config: client.Configuration,
  settings: OidcSettings,
  state: string,
): Promise<{ url: URL; codeVerifier: string }> {
  const codeVerifier = client.randomPKCECodeVerifier();

  const url = client.buildAuthorizationUrl(config, {
    code_challenge: await client.calculatePKCECodeChallenge(codeVerifier),
    code_challenge_method: "S256",
    redirect_uri: settings.oauthRelayUrl,
    scope: "openid email profile",
    state,
  });

  return { codeVerifier, url };
}

export async function exchangeCodeForClaims(
  config: client.Configuration,
  currentUrl: URL | Request,
  expectedState: string,
  pkceCodeVerifier: string,
) {
  const tokens = await client.authorizationCodeGrant(config, currentUrl, {
    expectedState,
    pkceCodeVerifier,
  });

  return tokens.claims();
}
