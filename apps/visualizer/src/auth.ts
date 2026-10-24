import { createAuthClient } from "better-auth/react";
import env from "./env";

export const auth = createAuthClient({
  // biome-ignore lint/style/useNamingConvention: Better Auth option
  baseURL: env.VITE_SERVER_URL,
});

export const signIn = async () => {
  const result = await auth.signIn.social({
    provider: "keycloak",
    // biome-ignore lint/style/useNamingConvention: Better Auth option
    callbackURL: window.location.href,
  });
  if (result.error) throw new Error(result.error.message ?? "Sign-in failed");
};
