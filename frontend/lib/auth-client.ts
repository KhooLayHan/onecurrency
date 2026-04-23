import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "../../backend/src/auth";
import { env } from "../env";

export const authClient = createAuthClient({
  baseURL: `${env.NEXT_PUBLIC_API_URL}/api/v1/auth`,
  plugins: [
    inferAdditionalFields<typeof auth>(), // Ensures correct typing
  ],
});

// Destructure the hooks for easy use in your components
export const { signIn, signUp, signOut, useSession } = authClient;
