import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins";
import { db } from "./db";
import { accounts } from "./db/schema/accounts";
import { rateLimits } from "./db/schema/rate-limit";
import { sessions } from "./db/schema/sessions";
import { twoFactors } from "./db/schema/two-factor";
import { users } from "./db/schema/users";
import { verifications } from "./db/schema/verifications";
import { env } from "./env";
import { sendPasswordResetEmail } from "./lib/email";
import { logger } from "./lib/logger";
import { WalletService } from "./services/wallet.service";

const walletService = new WalletService(db);

export const auth = betterAuth({
  appName: "OneCurrency",

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      users,
      session: sessions,
      account: accounts,
      verification: verifications,
      twoFactor: twoFactors,
      rateLimit: rateLimits,
    },
  }),

  basePath: "/api/v1/auth",
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.CORS_ORIGIN],

  emailAndPassword: {
    enabled: true,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      // Not awaited: email failure must never block or reveal timing info about
      // whether the email address exists (OWASP authentication best practice)
      await sendPasswordResetEmail(user.email, url);
    },
  },

  plugins: [twoFactor()],

  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    // /sign-in/email is automatically limited to 3 req / 10s by better-auth
    // /two-factor/* is automatically limited to 3 req / 10s by the twoFactor plugin
  },

  user: {
    modelName: "users",
    additionalFields: {
      publicId: { type: "string", required: false, input: false },
      kycStatusId: { type: "number", required: false, input: false },
      depositLimitCents: {
        type: "number",
        required: false,
        defaultValue: 100_000,
        input: false,
      },
      kycVerifiedAt: { type: "date", required: false, input: false },
      deletedAt: { type: "date", required: false, input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const result = await walletService.provisionCustodialWallet(
            BigInt(user.id)
          );
          if (result.isErr()) {
            logger.error(
              { err: result.error, userId: user.id },
              "Failed to provision custodial wallet after registration"
            );
          } else {
            logger.info(
              { userId: user.id, address: result.value.address },
              "Custodial wallet provisioned for new user"
            );
          }
        },
      },
    },
  },

  advanced: {
    database: {
      generateId: false,
    },
  },
});

export type AuthType = {
  user: typeof auth.$Infer.Session.user | null;
  session: typeof auth.$Infer.Session.session | null;
};
