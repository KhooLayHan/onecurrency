import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  emptyStringAsUndefined: true,
  server: {
    API_URL: z.url(),
  },
  client: {
    NEXT_PUBLIC_API_URL: z.httpUrl(),
    NEXT_PUBLIC_CHAIN_ID: z.enum(["31337", "11155111"]),
    NEXT_PUBLIC_POSTHOG_HOST: z.httpUrl().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  },
  runtimeEnv: {
    API_URL: process.env.API_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  },
});
