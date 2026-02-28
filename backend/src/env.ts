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

    LOCAL_RPC_URL: z.url().optional().default("http://localhost:8545"),
    SEPOLIA_RPC_URL: z.httpUrl().optional(),
    SEPOLIA_PRIVATE_KEY: z
      .string()
      .regex(/^0x[0-9a-fA-F]{64}$/)
      .optional(),

    CORS_ORIGIN: z.string().default("http://localhost:3000"),

    BETTERSTACK_SOURCE_TOKEN: z.string().min(1),
    BETTERSTACK_INGESTING_HOST: z.url(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
