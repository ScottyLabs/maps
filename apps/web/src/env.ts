// The SPA is built in a sandbox with no secrets, so nothing is inlined at build
// time: the server hands these over at boot from GET /api/config.

export interface RuntimeConfig {
  googleMapsApiKey: string | null;
  ignoreLogin: boolean;
  mapkitToken: string | null;
  posthogHost: string | null;
  posthogKey: string | null;
}

let config: RuntimeConfig = {
  googleMapsApiKey: null,
  ignoreLogin: false,
  mapkitToken: null,
  posthogHost: null,
  posthogKey: null,
};

export async function loadConfig(): Promise<void> {
  try {
    const response = await fetch("/api/config", { credentials: "include" });
    if (response.ok) {
      config = (await response.json()) as RuntimeConfig;
    } else {
      console.error(`Failed to load /api/config: ${response.status}`);
    }
  } catch (error) {
    console.error("Failed to load /api/config", error);
  }
}

export const env = {
  get googleMapsApiKey(): string | undefined {
    return config.googleMapsApiKey ?? undefined;
  },
  get ignoreLogin(): boolean {
    return config.ignoreLogin;
  },
  get mapkitToken(): string | undefined {
    return config.mapkitToken ?? undefined;
  },
  get posthogHost(): string | undefined {
    return config.posthogHost ?? undefined;
  },
  get posthogKey(): string | undefined {
    return config.posthogKey ?? undefined;
  },
};
