import { sql } from "drizzle-orm";
import { db } from "./db";
import { seedKycStatuses } from "./db/seed/kycStatuses";
import { seedNetworks } from "./db/seed/networks";
import { seedTransactionStatuses } from "./db/seed/transactionStatuses";
import { seedTransactionTypes } from "./db/seed/transactionTypes";

const reset = async (): Promise<void> => {
  const tables = await db.execute<{ table_name: string }>(
    sql`
        select table_name
        from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'
    `
  );

  for (const { table_name } of tables.rows) {
    await db.execute(
      sql.raw(`truncate table '${table_name}' restart identity cascade`)
    );
  }
};

reset();

await seedKycStatuses();
await seedTransactionStatuses();
await seedTransactionTypes();
await seedNetworks();
