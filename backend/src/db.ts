import "dotenv/config";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { kycStatuses } from "./db/schema/kyc-statuses";
import { networks } from "./db/schema/networks";
import { transactionStatuses } from "./db/schema/transaction-statuses";
import { transactionTypes } from "./db/schema/transaction-types";
import { env } from "./env";

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: env.DATABASE_URL });
export const db = drizzle({
  client: pool,
  schema: {
    ...kycStatuses,
    ...transactionStatuses,
    ...transactionTypes,
    ...networks,
  },
  logger: true,
});
