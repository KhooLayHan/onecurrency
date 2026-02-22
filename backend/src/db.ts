import "dotenv/config";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import { kycStatuses } from "./db/schema/kycStatuses";
import { networks } from "./db/schema/networks";
import { relation_ } from "./db/schema/relations";
import { transactionStatuses } from "./db/schema/transactionStatuses";
import { transactionTypes } from "./db/schema/transactionTypes";
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
    relation_,
  },
  logger: env.NODE_ENV !== "production",
});
