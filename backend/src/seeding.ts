import { sql } from "drizzle-orm";
import { db, pool } from "./db";
import { seedKycStatuses } from "./db/seed/kyc-statuses";
import { seedNetworks } from "./db/seed/networks";
import { seedRoles } from "./db/seed/roles";
import { seedTransactionStatuses } from "./db/seed/transaction-statuses";
import { seedTransactionTypes } from "./db/seed/transaction-types";

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

await pool.end();
