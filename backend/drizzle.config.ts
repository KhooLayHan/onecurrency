import { defineConfig } from "drizzle-kit";
import { env } from "./src/env";

export default defineConfig({
  schema: "./src/db/schema/**/*.ts",
  out:
    env.NODE_ENV === "production"
      ? "./src/db/migrations/prod"
      : "./src/db/migrations/dev",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DIRECT_DATABASE_URL,
  },
  strict: true,
  verbose: true,
});
