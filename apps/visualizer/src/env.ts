import { z } from "zod";

const publicEnvSchema = z.object({
  PUBLIC_MAPKIT_TOKEN: z.string().optional(),
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

const env = {
  get mapkitToken() {
    return publicEnv.PUBLIC_MAPKIT_TOKEN;
  },
};

export default env;
