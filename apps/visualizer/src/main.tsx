import {
  ClerkLoaded,
  ClerkProvider,
  RedirectToSignIn,
  SignedIn,
  SignedOut,
} from "@clerk/clerk-react";
import type { Clerk } from "@clerk/types";
import { StrictMode } from "react";
import { Provider } from "react-redux";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import env from "./env.ts";
import { routeTree } from "./routeTree.gen.ts";
import { USE_STRICT_MODE } from "./settings.ts";
import { store } from "./store/store.ts";

// https://clerk.com/docs/components/control/clerk-loaded
declare global {
  interface Window {
    Clerk: Clerk;
  }
}

// Create a query client
const queryClient = new QueryClient();

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const AppContent = () => (
  <ClerkProvider
    publishableKey={env.VITE_CLERK_PUBLISHABLE_KEY}
    afterSignOutUrl="/"
  >
    <ClerkLoaded>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <SignedIn>
            <RouterProvider router={router} />
          </SignedIn>
        </QueryClientProvider>
        <SignedOut>
          <RedirectToSignIn />
        </SignedOut>
      </Provider>
    </ClerkLoaded>
  </ClerkProvider>
);

// Render the app
const rootElement = document.getElementById("root") as HTMLElement;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    USE_STRICT_MODE ? (
      <StrictMode>
        <AppContent />
      </StrictMode>
    ) : (
      <AppContent />
    ),
  );
}
