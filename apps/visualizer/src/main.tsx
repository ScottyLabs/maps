import { StrictMode, useState } from "react";
import { Provider } from "react-redux";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import { auth, signIn } from "./auth";
import env from "./env";
import { routeTree } from "./routeTree.gen";
import { USE_STRICT_MODE } from "./settings";
import { store } from "./store/store";

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

function AppContent() {
  const { data: session, isPending } = auth.useSession();
  const [error, setError] = useState("");
  if (!env.VITE_IGNORE_LOGIN && isPending) return <p>Checking session…</p>;
  if (!env.VITE_IGNORE_LOGIN && !session) {
    return (
      <main className="m-auto max-w-lg space-y-5 p-10">
        <h1 className="font-semibold text-2xl">CMU Maps visualizer</h1>
        <p>Sign in with your ScottyLabs account to edit map data.</p>
        <button
          type="button"
          className="rounded bg-blue-700 px-4 py-2 text-white"
          onClick={() => {
            signIn().catch((cause: Error) => setError(cause.message));
          }}
        >
          Sign in with Keycloak
        </button>
        {error && <p role="alert">{error}</p>}
      </main>
    );
  }
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </Provider>
  );
}

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
