import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const PORT_NUMBER: number = 3030 as const;

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "testing", "staging", "production"])
      .default("development"),
    API_PORT: z.coerce.number().int().min(1).default(PORT_NUMBER),

    DATABASE_URL: z.url(),
    DIRECT_DATABASE_URL: z.url(),

    DB_SEEDING: z.stringbool().default(false),
    DB_MIGRATION: z.stringbool().default(false),

    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_URL: z.url(),

    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

    MASTER_ENCRYPTION_KEY: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .optional(),

    ADMIN_SECRET: z.string().min(1).optional(),

    LOCAL_RPC_URL: z.url(),
    SEPOLIA_RPC_URL: z.httpUrl().optional(),
    SEPOLIA_PRIVATE_KEY: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .optional(),
    TREASURY_ADDRESS: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address")
      .optional(),
    ETHERSCAN_API_KEY: z.string().min(1).optional(),

    // STRIPE_SECRET_KEY: z.string().startsWith("sk_test"),
    // STRIPE_PUBLISHABLE_KEY: z.string().startsWith("pk_test"),
    STRIPE_SECRET_KEY: z.string().regex(/^sk_(test|live)_/),
    STRIPE_PUBLISHABLE_KEY: z.string().regex(/^pk_(test|live)_/),
    STRIPE_WEBHOOK_SECRET: z.string(),

    CORS_ORIGIN: z.string().default("http://localhost:3000"),

    BETTERSTACK_SOURCE_TOKEN: z.string().min(1),
    BETTERSTACK_INGESTING_HOST: z.string().min(1),

    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_BUCKET_NAME: z.string().min(1).optional(),
    R2_PUBLIC_URL: z.url().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});

// Cross-field validation: R2 variables must be all present or all absent
const r2Vars = [
  env.R2_ACCOUNT_ID,
  env.R2_ACCESS_KEY_ID,
  env.R2_SECRET_ACCESS_KEY,
  env.R2_BUCKET_NAME,
];
const r2Defined = r2Vars.filter(Boolean).length;
if (r2Defined > 0 && r2Defined < r2Vars.length) {
  throw new Error(
    "R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME must all be set together or not at all."
  );
}
