import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { db, pool } from "./db";

await migrate(db, { migrationsFolder: "./src/db/migrations" })
  .then()
  .finally(() => pool.end());
