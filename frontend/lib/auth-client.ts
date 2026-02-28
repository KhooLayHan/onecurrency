import { createAuthClient } from "better-auth/react";
import { env } from "../env";

export const authClient = createAuthClient({
  baseURL: env.NEXT_PUBLIC_BETTER_AUTH_URL,
});

// Destructure the hooks for easy use in your components
export const { signIn, signUp, signOut, useSession } = authClient;
