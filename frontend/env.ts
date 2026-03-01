import "dotenv/config"
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    API_URL: z.httpUrl(),
    // NODE_ENV: z.enum(["development", "production", "testing", "staging"]),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.httpUrl(),
    NEXT_PUBLIC_POSTHOG_HOST: z.httpUrl(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string(),
    NEXT_PUBLIC_CHAIN_ID: z.enum(["31337", "11155111"]).default("11155111"), // Sepolia default
    NEXT_PUBLIC_WALLET_CONNECT_ID: z.string().min(1), // For AppKit/Wagmi
    NEXT_PUBLIC_BETTER_AUTH_URL: z.url(),
  },
  runtimeEnv: {
    API_URL: process.env.API_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
    NEXT_PUBLIC_WALLET_CONNECT_ID: process.env.NEXT_PUBLIC_WALLET_CONNECT_ID,
    NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
  },
  emptyStringAsUndefined: true,
});
