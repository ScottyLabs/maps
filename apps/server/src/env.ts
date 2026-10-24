/** biome-ignore-all lint/style/useNamingConvention: environment variables are in all caps */
import process from "node:process";
import { z } from "zod";

// Define the schema as an object with all of the env
// variables and their types
const envSchema = z.object({
  ALLOWED_ORIGINS_REGEX: z.string(),
  AUTH_CLIENT_ID: z.string(),
  AUTH_CLIENT_SECRET: z.string(),
  AUTH_ISSUER: z.string(),
  AUTH_JWKS_URI: z.string(),
  BETTER_AUTH_URL: z.url(), // https://www.better-auth.com/docs/installation#set-environment-variables
  DATABASE_URL: z.string(),
  OAUTH_RELAY_URL: z.url().optional(),
  IGNORE_LOGIN: z
    .string()
    .default("false")
    .transform((val) => val === "true"),
  SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(80),
  SERVER_HOST: z.string().optional(),
  SERVER_URL: z.url(),
});

// Validate `process.env` against our schema and return the result
const env = envSchema.parse(process.env);

// Export the result so we can use it in the project
export { env };
