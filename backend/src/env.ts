import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const PORT_NUMBER = 3030;

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.string().transform(Number).default(PORT_NUMBER),

    DATABASE_URL: z.httpUrl(),
    DIRECT_DATABASE_URL: z.httpUrl(),

    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_KEY: z.httpUrl(),

    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

    MASTER_ENCRYPTION_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),

    ADMIN_SECRET: z.string().min(1),

    LOCAL_RPC_URL: z.httpUrl().default("http://localhost:8545"),
    SEPOLIA_RPC_URL: z.httpUrl(),
    SEPOLIA_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),

    CORS_ORIGIN: z.string().default("http://localhost:3000"),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
