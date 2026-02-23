import "dotenv/config";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { accounts } from "./db/schema/accounts";
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
import { env } from "./env";

neonConfig.webSocketConstructor = ws;

export const pool = new Pool({ connectionString: env.DATABASE_URL });

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
    relations,
  },
  logger: env.NODE_ENV !== "production",
  casing: "snake_case",
});
