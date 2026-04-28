import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { privateKeyToAccount } from "viem/accounts";
import z from "zod";
import { db } from "@/src/db";
import { networks } from "@/src/db/schema/networks";
import { env } from "@/src/env";
import { BlacklistService } from "@/src/services/blacklist.service";
import { activeChainId } from "@/src/services/blockchain";
import { KycAdminService } from "@/src/services/kyc-admin.service";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requirePermission, requireRole } from "../middleware";

const kycAdminService = new KycAdminService(db);
const blacklistService = new BlacklistService(db);

const KYC_PAGE_SIZE = 20;
const BLACKLIST_PAGE_SIZE = 20;
const BLACKLIST_REASON_MIN_LENGTH = 5;

const TREASURY_ADDRESS: `0x${string}` | null =
  (env.TREASURY_ADDRESS as `0x${string}`) ?? null;

// Safety: treasury must not be the same wallet as the operator
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

// ─── KYC Procedures ─────────────────────────────────────────────────────────

export const listKycSubmissions = base
  .use(requirePermission("kyc:read"))
  .input(
    z.object({
      page: z.number().int().min(1).default(1),
      kycStatusId: z.number().int().optional(),
      search: z.string().optional(),
    })
  )
  .output(
    z.object({
      items: z.array(
        z.object({
          publicId: z.string(),
          fullName: z.string(),
          documentType: z.string(),
          kycStatusId: z.number(),
          createdAt: z.date(),
          userEmail: z.string(),
          userName: z.string(),
        })
      ),
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
    })
  )
  .handler(async ({ input }) => {
    const result = await kycAdminService.listSubmissions({
      page: input.page,
      pageSize: KYC_PAGE_SIZE,
      kycStatusId: input.kycStatusId,
      search: input.search,
    });
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    return {
      ...result.value,
      page: input.page,
      pageSize: KYC_PAGE_SIZE,
    };
  });

export const getKycSubmission = base
  .use(requirePermission("kyc:read"))
  .input(z.object({ publicId: z.uuid() }))
  .output(
    z.object({
      submission: z.object({
        publicId: z.string(),
        fullName: z.string(),
        dateOfBirth: z.string(),
        nationality: z.string(),
        documentType: z.string(),
        kycStatusId: z.number(),
        rejectionReason: z.string().nullable(),
        reviewedAt: z.date().nullable(),
        createdAt: z.date(),
        userId: z.string(),
      }),
      documentFrontUrl: z.string().nullable(),
      documentBackUrl: z.string().nullable(),
      selfieUrl: z.string().nullable(),
    })
  )
  .handler(async ({ input }) => {
    const result = await kycAdminService.getSubmission(input.publicId);
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    const { submission, documentFrontUrl, documentBackUrl, selfieUrl } =
      result.value;
    return {
      submission: {
        publicId: submission.publicId,
        fullName: submission.fullName,
        dateOfBirth: submission.dateOfBirth,
        nationality: submission.nationality,
        documentType: submission.documentType,
        kycStatusId: submission.kycStatusId,
        rejectionReason: submission.rejectionReason ?? null,
        reviewedAt: submission.reviewedAt,
        createdAt: submission.createdAt,
        userId: submission.userId.toString(),
      },
      documentFrontUrl,
      documentBackUrl,
      selfieUrl,
    };
  });

export const approveKyc = base
  .use(requirePermission("kyc:verify"))
  .input(z.object({ publicId: z.uuid() }))
  .output(z.object({ message: z.string() }))
  .handler(async ({ input, context }) => {
    const result = await kycAdminService.approve(
      input.publicId,
      BigInt(context.session.userId)
    );
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    return { message: "KYC submission approved" };
  });

export const rejectKyc = base
  .use(requirePermission("kyc:reject"))
  .input(
    z.object({
      publicId: z.uuid(),
      reason: z
        .string()
        .min(10, "Rejection reason must be at least 10 characters"),
    })
  )
  .output(z.object({ message: z.string() }))
  .handler(async ({ input, context }) => {
    const result = await kycAdminService.reject(
      input.publicId,
      BigInt(context.session.userId),
      input.reason
    );
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    return { message: "KYC submission rejected" };
  });

// ─── Blacklist Procedures ────────────────────────────────────────────────────

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
