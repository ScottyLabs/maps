import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { env } from "@/env.ts";
import { initializePreviewContext } from "./preview";
import { App } from "./App.tsx";
import "./index.css";
import { NuqsAdapter } from "nuqs/adapters/react";
import posthog from "posthog-js";

// Initialize Posthog https://posthog.com/docs/libraries/react
posthog.init(env.VITE_PUBLIC_POSTHOG_KEY || "", {
  // biome-ignore lint/style/useNamingConvention: posthog config is in snake_case
  api_host: env.VITE_PUBLIC_POSTHOG_HOST,
});

// Create a query client
const queryClient = new QueryClient();

// Render the App
if (await initializePreviewContext())
  createRoot(document.getElementById("root") as HTMLElement).render(
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
