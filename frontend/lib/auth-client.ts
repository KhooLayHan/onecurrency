import {
  inferAdditionalFields,
  twoFactorClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { toast } from "sonner";
import type { auth } from "../../backend/src/auth";
import { env } from "../env";

export const authClient = createAuthClient({
  baseURL: `${env.NEXT_PUBLIC_API_URL}/api/v1/auth`,
  plugins: [
    inferAdditionalFields<typeof auth>(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/two-factor";
      },
    }),
  ],
  fetchOptions: {
    onError: async (context) => {
      if (context.response.status === 429) {
        const retryAfter = context.response.headers.get("X-Retry-After");
        const seconds = retryAfter ? Number(retryAfter) : null;
        toast.error(
          seconds
            ? `Too many attempts. Try again in ${seconds}s.`
            : "Too many attempts. Please wait before trying again."
        );
      }
    },
  },
});

export const { signIn, signUp, signOut, useSession } = authClient;
