import "dotenv/config";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { accounts } from "./db/schema/accounts";
import { auditLogs } from "./db/schema/audit-logs";
import { blacklistedAddresses } from "./db/schema/blacklisted-addresses";
import { blockchainTransactions } from "./db/schema/blockchain-transactions";
import { deposits } from "./db/schema/deposits";
import { kycStatuses } from "./db/schema/kyc-statuses";
import { networks } from "./db/schema/networks";
import { relations } from "./db/schema/relations";
import { roles } from "./db/schema/roles";
import { sessions } from "./db/schema/sessions";
import { transactionStatuses } from "./db/schema/transaction-statuses";
import { transactionTypes } from "./db/schema/transaction-types";
import { userRoles } from "./db/schema/user-roles";
import { users } from "./db/schema/users";
import { verifications } from "./db/schema/verifications";
import { wallets } from "./db/schema/wallets";
import { webhookEvents } from "./db/schema/webhook-events";
import { env } from "./env";

neonConfig.webSocketConstructor = ws;

// const migrationPool = new Pool({
//   connectionString: env.DIRECT_DATABASE_URL,
//   max: 1,
// });
// const seedingPool = new Pool({
//   connectionString: env.DIRECT_DATABASE_URL,
//   max: 1,
// });
const developmentPool = new Pool({
  connectionString: env.DATABASE_URL,
});
const productionPool = new Pool({
  connectionString: env.DATABASE_URL,
});

// export const migrationPool = new Pool({
//   connectionString: env.DIRECT_DATABASE_URL,
// });

// export const seedingPool = new Pool({
//   connectionString: env.DIRECT_DATABASE_URL,
// });

// let pool: Pool;
// if (env.NODE_ENV === "production") {
//   pool = new Pool({ connectionString: env.DATABASE_URL });
// } else {
//   pool = new Pool({ connectionString: env.DEV_DATABASE_URL });
// }

// export pool;
// export const pool = new Pool(
//   env.NODE_ENV === "production"
//     ? { connectionString: env.DATABASE_URL }
//     : { connectionString: env.DIRECT_DATABASE_URL, max: 1 }
// );

export let pool: Pool = new Pool({
  connectionString: env.DATABASE_URL,
});

// if (env.NODE_ENV === "production") {
//   pool = productionPool;
// }

if (env.DB_MIGRATION === true || env.DB_SEEDING === true) {
  pool = new Pool({
    connectionString: env.DIRECT_DATABASE_URL,
    max: 1,
  });
}

export const db = drizzle({
  client: pool,
  schema: {
    kycStatuses,
    transactionStatuses,
    transactionTypes,
    networks,
    roles,
    userRoles,
    users,
    sessions,
    accounts,
    verifications,
    wallets,
    deposits,
    blockchainTransactions,
    auditLogs,
    blacklistedAddresses,
    webhookEvents,
    relations,
  },
  logger: env.NODE_ENV !== "production",
  casing: "snake_case",
});
