/**
 * Admin blacklist procedures.
 *
 * Exposes four oRPC procedures for managing the on-chain address blacklist:
 *
 * - `listBlacklist`      — paginated list of currently blacklisted addresses.
 * - `addToBlacklist`     — blacklists an address on-chain and records the entry.
 * - `removeFromBlacklist`— un-blacklists an address on-chain and removes the record.
 * - `seizeTokens`        — seizes all tokens from a blacklisted address and
 *                          transfers them to the configured treasury wallet.
 *
 * All procedures require the `blacklist:manage` permission except `seizeTokens`,
 * which is restricted to the `admin` role due to its irreversible nature.
 *
 * Safety invariant: `TREASURY_ADDRESS` is validated at module load time to
 * ensure it is never the same wallet as the operator (relayer) account.
 */
import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { privateKeyToAccount } from "viem/accounts";
import z from "zod";
import { db } from "@/src/db";
import { networks } from "@/src/db/schema/networks";
import { env } from "@/src/env";
import { BlacklistService } from "@/src/services/blacklist.service";
import { activeChainId } from "@/src/services/blockchain/client";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requirePermission, requireRole } from "../middleware";

const blacklistService = new BlacklistService(db);

/** Number of blacklist entries returned per page. */
const BLACKLIST_PAGE_SIZE = 20;

/** Minimum character length for a blacklist reason string. */
const BLACKLIST_REASON_MIN_LENGTH = 5;

/**
 * The treasury wallet address that receives seized tokens.
 * Loaded from `TREASURY_ADDRESS` env var and validated at startup.
 */
const TREASURY_ADDRESS: `0x${string}` | null =
  (env.TREASURY_ADDRESS as `0x${string}`) ?? null;

/**
 * Module-load safety check: asserts that the configured treasury address is
 * never the same wallet as the operator (relayer) account derived from
 * `SEPOLIA_PRIVATE_KEY`. Running at import time means a misconfiguration is
 * caught at startup rather than at the point of an irreversible seize call.
 */
if (TREASURY_ADDRESS && env.SEPOLIA_PRIVATE_KEY) {
  const operatorAddress = privateKeyToAccount(
    (env.SEPOLIA_PRIVATE_KEY.startsWith("0x")
      ? env.SEPOLIA_PRIVATE_KEY
      : `0x${env.SEPOLIA_PRIVATE_KEY}`) as `0x${string}`
  ).address;

  if (operatorAddress.toLowerCase() === TREASURY_ADDRESS.toLowerCase()) {
    throw new Error(
      "TREASURY_ADDRESS must not be the same as the operator wallet (SEPOLIA_PRIVATE_KEY)"
    );
  }
}

/**
 * Returns a paginated list of blacklisted addresses, optionally filtered
 * by network ID or a text search term.
 *
 * @permission blacklist:manage
 * @input  page      - 1-based page number (default 1).
 * @input  networkId - Optional network ID to filter by.
 * @input  search    - Optional text to search against address or reason.
 * @output Paginated list of blacklist entries.
 */
export const listBlacklist = base
  .use(requirePermission("blacklist:manage"))
  .input(
    z.object({
      page: z.number().int().min(1).default(1),
      networkId: z.number().int().optional(),
      search: z.string().optional(),
    })
  )
  .output(
    z.object({
      items: z.array(
        z.object({
          publicId: z.string(),
          address: z.string(),
          networkId: z.number().nullable(),
          networkName: z.string().nullable(),
          reason: z.string(),
          source: z.string().nullable(),
          addedByName: z.string().nullable(),
          createdAt: z.date(),
          expiresAt: z.date().nullable(),
        })
      ),
      total: z.number(),
      page: z.number(),
    })
  )
  .handler(async ({ input }) => {
    const result = await blacklistService.list({
      page: input.page,
      pageSize: BLACKLIST_PAGE_SIZE,
      networkId: input.networkId,
      search: input.search,
    });
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    return { ...result.value, page: input.page };
  });

/**
 * Blacklists an Ethereum address on-chain and records the entry in the DB.
 *
 * The procedure looks up the active network by chain ID to associate the
 * entry with the correct network record before calling the contract.
 *
 * @permission blacklist:manage
 * @input  address - The Ethereum address to blacklist (must be a valid 0x address).
 * @input  reason  - Human-readable reason for blacklisting (min 5 characters).
 * @input  source  - Optional provenance string (e.g. "OFAC", "manual").
 * @output Confirmation message.
 */
export const addToBlacklist = base
  .use(requirePermission("blacklist:manage"))
  .input(
    z.object({
      address: z
        .string()
        .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
      reason: z.string().min(BLACKLIST_REASON_MIN_LENGTH, "Reason is required"),
      source: z.string().optional(),
    })
  )
  .output(z.object({ message: z.string() }))
  .handler(async ({ input, context }) => {
    const [activeNetwork] = await db
      .select({ id: networks.id })
      .from(networks)
      .where(eq(networks.chainId, BigInt(activeChainId)))
      .limit(1);

    if (!activeNetwork) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Active network not configured in database",
      });
    }

    const result = await blacklistService.add({
      address: input.address,
      networkId: activeNetwork.id,
      reason: input.reason,
      source: input.source,
      addedByUserId: BigInt(context.session.userId),
    });
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    return { message: "Address blacklisted successfully" };
  });

/**
 * Removes an address from the blacklist, restoring its ability to transact.
 * The removal is recorded with the acting admin's user ID for audit purposes.
 *
 * @permission blacklist:manage
 * @input  publicId - UUID of the blacklist entry to remove.
 * @output Confirmation message.
 */
export const removeFromBlacklist = base
  .use(requirePermission("blacklist:manage"))
  .input(z.object({ publicId: z.string().uuid() }))
  .output(z.object({ message: z.string() }))
  .handler(async ({ input, context }) => {
    const result = await blacklistService.remove(
      input.publicId,
      BigInt(context.session.userId)
    );
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    return { message: "Address removed from blacklist" };
  });

/**
 * Seizes all ONE tokens from a blacklisted address and transfers them to
 * the configured treasury wallet.
 *
 * This is an irreversible on-chain action and is therefore restricted to
 * the `admin` role (stricter than the general `blacklist:manage` permission).
 * Requires `TREASURY_ADDRESS` to be configured in the environment.
 *
 * @role   admin
 * @input  publicId - UUID of the blacklist entry whose tokens should be seized.
 * @output Confirmation message.
 */
export const seizeTokens = base
  .use(requireRole("admin"))
  .input(z.object({ publicId: z.uuid() }))
  .output(z.object({ message: z.string() }))
  .handler(async ({ input, context }) => {
    if (!TREASURY_ADDRESS) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Treasury wallet not configured",
      });
    }

    const result = await blacklistService.seize(
      input.publicId,
      TREASURY_ADDRESS,
      BigInt(context.session.userId)
    );
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    return { message: "Tokens seized successfully" };
  });
