import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { db, pool } from "./db";

// ! TODO: migrate() implementation currently does not work and bugged with the latest drizzle-orm beta version.
// ! Possible suggestions:
// * 1. Ignore entirely and wait patiently until bug is fixed by the official drizzle team
// * 2. Downgrade to a lower, stable version. If downgraded, version 2 Relational Syntax (e.g. `defineRelations`) would not work
await migrate(db, { migrationFolder: "./src/db/migrations" })
  .then()
  .finally(() => pool.end());
