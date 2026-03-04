import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "testing", "staging", "production"])
      .default("development"),

    SEPOLIA_RPC_URL: z.httpUrl(),
    SEPOLIA_PRIVATE_KEY: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
    ETHERSCAN_API_KEY: z.string().optional(),

    BETTERSTACK_SOURCE_TOKEN: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
