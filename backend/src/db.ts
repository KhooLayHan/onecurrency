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

const connectionString =
  env.DB_MIGRATION || env.DB_SEEDING
    ? env.DIRECT_DATABASE_URL
    : env.DATABASE_URL;
const poolSize = env.DB_MIGRATION || env.DB_SEEDING ? 1 : undefined;

export const pool: Pool = new Pool({
  connectionString,
  max: poolSize,
});

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
