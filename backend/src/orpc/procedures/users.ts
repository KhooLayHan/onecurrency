/**
 * Core user procedures.
 *
 * Handles user identity and wallet operations that are not specific to KYC:
 *
 * - `getPrimaryWallet` — returns the authenticated user's primary custodial
 *                        wallet address and its associated network info.
 * - `findRecipient`    — looks up a user by email for the transfer recipient
 *                        preview step. Collapses "not found" and "self" cases
 *                        into a single generic error to avoid user enumeration.
 * - `getMyRoles`       — returns the list of role names assigned to the
 *                        current user (e.g. "admin", "user").
 *
 * KYC-related procedures live in `users-kyc.ts`.
 * All procedures require an authenticated session via `requireAuth`.
 */
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import z from "zod";
import { db } from "@/src/db";
import { roles } from "@/src/db/schema/roles";
import { userRoles } from "@/src/db/schema/user-roles";
import { logger } from "@/src/lib/logger";
import { UserRepository } from "@/src/repositories/user.repository";
import { WalletService } from "@/src/services/wallet.service";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requireAuth } from "../middleware";

const walletService = new WalletService(db);
const userRepository = new UserRepository(db);

/**
 * Returns the authenticated user's primary custodial wallet.
 *
 * The wallet address is needed by the frontend to read the on-chain token
 * balance directly from the contract without a server round-trip.
 *
 * @auth   requireAuth
 * @output walletId  - Internal wallet identifier (stringified bigint).
 * @output address   - The wallet's Ethereum address.
 * @output networkId - Database ID of the associated network record.
 * @output chainId   - Numeric EVM chain ID (e.g. 1337 for Hardhat, 11155111 for Sepolia).
 */
export const getPrimaryWallet = base
  .use(requireAuth)
  .output(
    z.object({
      walletId: z.string(),
      address: z.string(),
      networkId: z.number(),
      chainId: z.number(),
    })
  )
  .handler(async ({ context }) => {
    const userId = context.session?.userId;
    if (!userId) {
      logger.warn("getPrimaryWallet called without authenticated session");
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    const result = await walletService.getUserPrimaryWallet(BigInt(userId));
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }

    const { walletId, address, networkId, chainId } = result.value;
    logger.info({ userId, chainId }, "User primary wallet fetched");
    return {
      walletId: walletId.toString(),
      address,
      networkId,
      chainId,
    };
  });

/**
 * Looks up a user by email address for the send-money recipient preview step.
 *
 * Both "user not found" and "user is yourself" cases are collapsed into a
 * single `NOT_FOUND` error to prevent user enumeration via the API.
 *
 * @auth   requireAuth
 * @input  email - The email address to look up.
 * @output name  - Display name of the found recipient.
 */
export const findRecipient = base
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/users/find-recipient",
    summary: "Look up a user by email to preview recipient before sending",
    tags: ["Users"],
  })
  .input(z.object({ email: z.string().email() }))
  .output(z.object({ name: z.string() }))
  .handler(async ({ input, context }) => {
    const userId = context.session?.userId;
    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    const result = await userRepository.findByEmail(input.email);
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }

    const recipient = result.value;

    // Generic error used for both "not found" and "self-transfer" to avoid
    // leaking information about which emails are registered in the system.
    const NO_ELIGIBLE_RECIPIENT = new ORPCError("NOT_FOUND", {
      message: "No eligible recipient found for this email.",
    });

    if (!recipient || recipient.id.toString() === userId) {
      logger.info(
        {
          userId,
          lookupEmail: input.email,
          reason: recipient ? "self_transfer" : "not_found",
        },
        "Recipient lookup rejected — collapsing to generic error"
      );
      throw NO_ELIGIBLE_RECIPIENT;
    }

    logger.info(
      { userId, lookupEmail: input.email },
      "Recipient lookup successful"
    );

    return { name: recipient.name };
  });

/**
 * Returns the role names assigned to the currently authenticated user.
 *
 * Used by the frontend to conditionally show admin navigation and gate
 * access to admin-only routes without a separate permission check endpoint.
 *
 * @auth   requireAuth
 * @output Array of role name strings (e.g. ["user", "admin"]).
 */
export const getMyRoles = base
  .use(requireAuth)
  .input(z.object({}))
  .output(z.array(z.string()))
  .handler(async ({ context }) => {
    const rows = await db
      .select({ name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, BigInt(context.session.userId)));
    return rows.map((r) => r.name);
  });
