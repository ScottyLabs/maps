import { z } from "zod";

const publicEnvSchema = z.object({
  PUBLIC_GOOGLE_MAPS_API_KEY: z.string().optional(),
  PUBLIC_MAPKIT_TOKEN: z.string().optional(),
  PUBLIC_POSTHOG_HOST: z.string().optional(),
  PUBLIC_POSTHOG_KEY: z.string().optional(),
});

let publicEnv: z.infer<typeof publicEnvSchema> = {};

export async function loadEnv() {
  try {
    const response = await fetch("/_kennel/env.json");

    if (!response.ok) {
      console.error(`Failed to load /_kennel/env.json: ${response.status}`);

      return;
    }

    publicEnv = publicEnvSchema.parse(await response.json());
  } catch (error) {
    console.error("Failed to load /_kennel/env.json", error);
  }
}

export const env = {
  get googleMapsApiKey() {
    return publicEnv.PUBLIC_GOOGLE_MAPS_API_KEY;
  },
  get mapkitToken() {
    return publicEnv.PUBLIC_MAPKIT_TOKEN;
  },
  get posthogHost() {
    return publicEnv.PUBLIC_POSTHOG_HOST;
  },
  get posthogKey() {
    return publicEnv.PUBLIC_POSTHOG_KEY;
  },
};
