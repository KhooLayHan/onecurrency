import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { db, pool } from "./db";

await migrate(db, { migrationFolder: "./src/db/migrations" });

await pool.end();
