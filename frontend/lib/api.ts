import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { env } from "@/env";

const API_V1_BASE_PATH = "/api/v1";

const link = new RPCLink({
  url: `${env.NEXT_PUBLIC_API_URL}${API_V1_BASE_PATH}`,
  fetch: (request, init) =>
    globalThis.fetch(request, {
      ...init,
      credentials: "include",
    }),
});

// The client is typed based on the backend router at runtime
export const orpcClient = createORPCClient(link);
