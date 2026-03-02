import { sql } from "drizzle-orm";
import { db, pool } from "./db";
import { seedKycStatuses } from "./db/seed/kyc-statuses";
import { seedNetworks } from "./db/seed/networks";
import { seedRoles } from "./db/seed/roles";
import { seedTransactionStatuses } from "./db/seed/transaction-statuses";
import { seedTransactionTypes } from "./db/seed/transaction-types";
import { env } from "./env";
import { logger } from "./lib/logger";
// import { seedSpecialUsers } from "./db/seed/special-users";
import { seedRegularUsers, seedSpecialUsers } from "./db/seed/users";
// import { seedUserRoles } from "./db/seed/user-roles";
// import { seedAccounts } from "./db/seed/accounts";
import { defaultSeedConfig } from "./db/seed/config";
// import { seedWallets } from "./db/seed/wallets";

if (env.NODE_ENV === "production") {
  logger.info("Seeding not allowed in production");
  process.exit(0);
}

if (env.DB_SEEDING !== true) {
  logger.info("DB_SEEDING must be set to true");
  process.exit(0);
}

const reset = async (): Promise<void> => {
  const tables = await db.execute<{ table_name: string }>(
    sql`
        select table_name
        from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
        and table_name not like '__drizzle%'
    `
  );

  for (const { table_name } of tables.rows) {
    await db.execute(
      sql`truncate table ${sql.identifier(table_name)} restart identity cascade`
    );
  }
};

await reset();

await seedKycStatuses();
await seedTransactionStatuses();
await seedTransactionTypes();
await seedNetworks();
await seedRoles();

await seedSpecialUsers();
await seedRegularUsers();
// await seedWallets();
// await seedAccounts();
// await seedUserRoles();

await pool.end();
