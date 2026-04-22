import { createORPCClient } from "@orpc/client";
import { createORPCReactQueryUtils } from "@orpc/react-query";
import { env } from "@/env";
import type { AppRouter } from "../../backend/src/orpc/router";

// 1. Create the base RPC client
export const orpcClient = createORPCClient<AppRouter>({
  // Point to the oRPC prefix we set up in Hono
  baseURL: `${env.NEXT_PUBLIC_API_URL}/api/rpc`,
  headers: () => ({
    // If you need to pass specific headers, do it here.
    // Better-Auth cookies are handled automatically by the browser if CORS `credentials: true` is set!
  }),
});

// 2. Create the React Query hooks!
export const orpc = createORPCReactQueryUtils<AppRouter>(orpcClient);
