// Built in a sandbox with no secrets, so the server hands these over at boot
// from GET /api/config.

interface RuntimeConfig {
  mapkitToken: string | null;
}

let config: RuntimeConfig = { mapkitToken: null };

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

const env = {
  get mapkitToken(): string | undefined {
    return config.mapkitToken ?? undefined;
  },
};

export default env;
