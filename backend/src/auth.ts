import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { accounts } from "./db/schema/accounts";
import { sessions } from "./db/schema/sessions";
import { users } from "./db/schema/users";
import { verifications } from "./db/schema/verifications";
import { env } from "./env";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),

  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  emailAndPassword: {
    enabled: true,
  },

  user: {
    modelName: "users",
    additionalFields: {
      publicId: { type: "string", required: true },
      kycStatusId: { type: "number", required: false, input: false },
      depositLimitCents: {
        type: "number",
        required: false,
        defaultValue: 100_000,
      },
      kycVerifiedAt: { type: "date", required: false, input: false },
      deletedAt: { type: "date", required: false, input: false },
    },
  },

  advanced: {
    database: {
      generateId: false, // Let PostgreSQL generate BIGINT IDs
    },
  },
});

export type AuthType = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};
