import { StrictMode } from "react";
import { Provider } from "react-redux";
import "./index.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import ReactDOM from "react-dom/client";
import RequireAuth from "./auth.tsx";
import { loadEnv } from "./env.ts";
import { routeTree } from "./routeTree.gen.ts";
import { USE_STRICT_MODE } from "./settings.ts";
import { store } from "./store/store.ts";

await loadEnv();

// Create a query client
const queryClient = new QueryClient();

// Create a new router instance
const router = createRouter({
  routeTree,
  basepath: import.meta.env.BASE_URL,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const AppContent = () => (
  <Provider store={store}>
    <QueryClientProvider client={queryClient}>
      <RequireAuth>
        <RouterProvider router={router} />
      </RequireAuth>
    </QueryClientProvider>
  </Provider>
);

// Render the app
const rootElement = document.querySelector("#root") as HTMLElement;

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
