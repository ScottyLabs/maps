/** biome-ignore-all lint/style/useNamingConvention: defined by better-auth */
import { betterAuth } from "better-auth";
import { genericOAuth, keycloak } from "better-auth/plugins";
import { env } from "../env.ts";
import { ricochetOAuth } from "./ricochetOAuth.ts";

const callbackURL = `${env.SERVER_URL.replace(/\/$/u, "")}/api/auth/oauth2/callback/keycloak`;

// https://www.better-auth.com/docs/installation#create-a-better-auth-instance
// https://www.better-auth.com/docs/plugins/generic-oauth#pre-configured-provider-helpers
export const auth = betterAuth({
  baseURL: env.SERVER_URL,
  trustedOrigins: [
    env.BETTER_AUTH_URL,
    ...(env.AUTH_TRUSTED_ORIGINS?.split(",") ?? []),
  ],
  plugins: [
    genericOAuth({
      config: [
        keycloak({
          clientId: env.AUTH_CLIENT_ID,
          clientSecret: env.AUTH_CLIENT_SECRET,
          issuer: env.AUTH_ISSUER,
          redirectURI: env.OAUTH_RELAY_URL ?? callbackURL,
          pkce: true,
          scopes: ["openid", "email", "profile", "offline_access"],
        }),
      ],
    }),
    ...(env.OAUTH_RELAY_URL
      ? [ricochetOAuth({ callbackURL, relayURL: env.OAUTH_RELAY_URL })]
      : []),
  ],
});
