import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { env, loadEnv } from "@/env.ts";
import { App } from "./App.tsx";
import "./index.css";
import { NuqsAdapter } from "nuqs/adapters/react";
import posthog from "posthog-js";

await loadEnv();

// Analytics is prod-only: governance writes PUBLIC_POSTHOG_KEY on the prod profile, so dev and previews run with the SDK inert rather than a bogus token.
if (env.posthogKey) {
  posthog.init(env.posthogKey, {
    // biome-ignore lint/style/useNamingConvention: posthog config is in snake_case
    api_host: env.posthogHost,
  });
}

// Create a query client
const queryClient = new QueryClient();

// Render the App
createRoot(document.querySelector("#root") as HTMLElement).render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <NuqsAdapter>
        <PostHogProvider client={posthog}>
          <StrictMode>
            <App />
          </StrictMode>
        </PostHogProvider>
      </NuqsAdapter>
    </QueryClientProvider>
  </BrowserRouter>,
);
