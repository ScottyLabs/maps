import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PostHogProvider } from "posthog-js/react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { initAnalytics } from "@/lib/analytics.ts";
import { App } from "./App.tsx";
import "./index.css";
import { NuqsAdapter } from "nuqs/adapters/react";
import posthog from "posthog-js";

// Initialize PostHog; stays off when no key is configured
initAnalytics();

// Create a query client
const queryClient = new QueryClient();

// Render the App
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
