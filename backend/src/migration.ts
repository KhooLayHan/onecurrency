import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { db, pool } from "./db";
import { env } from "./env";

if (env.DB_MIGRATION !== true) {
  // TODO: Will have to install pino logger dependencies
  // logger.info("DB_MIGRATION must be set to true");
  process.exit(1);
}

await migrate(db, { migrationsFolder: "./src/db/migrations" })
  .then()
  .finally(() => pool.end());
