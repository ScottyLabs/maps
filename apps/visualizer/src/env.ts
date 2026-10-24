import { z } from "zod";

// Define the schema as an object with all of the env
// variables and their types
const envSchema = z.object({
  VITE_SERVER_URL: z.url(),
  VITE_IGNORE_LOGIN: z.string().default("false").transform((value) => value === "true"),
  VITE_MAPKIT_TOKEN: z.string().optional(),
});

// Validate `process.env` against our schema
// and return the result
const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  throw new Error("Invalid environment variables");
}

const env = parsed.data;

// Export the result so we can use it in the project
export default env;
