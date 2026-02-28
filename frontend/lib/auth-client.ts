import { createAuthClient } from "better-auth/react";
import { env } from "../env"; // Your frontend type-safe env

export const authClient = createAuthClient({
  // Point this to your Hono API URL
  // e.g., "http://localhost:3030"
  baseURL: env.NEXT_PUBLIC_BETTER_AUTH_URL,
});

// Destructure the hooks for easy use in your components
export const { signIn, signUp, signOut, useSession } = authClient;
