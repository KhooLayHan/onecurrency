import { ORPCError } from "@orpc/server";
import z from "zod";
import { db } from "@/src/db";
import { logger } from "@/src/lib/logger";
import { UserService } from "@/src/services/user.service";
import { WalletService } from "@/src/services/wallet.service";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requireAuth } from "../middleware";

const userService = new UserService(db);
const walletService = new WalletService(db);

const DOCUMENT_TYPES_REQUIRING_BACK = new Set([
  "drivers_license",
  "national_id",
]);

// Zod schema for KYC submission (matches KycFormData from frontend)
const kycSubmissionInputSchema = z
  .object({
    fullName: z.string().min(1, "Full name is required"),
    dateOfBirth: z.coerce.date(),
    nationality: z
      .string()
      .length(2, "Nationality must be a 2-letter ISO code"),
    documentType: z.enum(["passport", "drivers_license", "national_id"]),
    documentFrontUploaded: z.literal(true),
    documentBackUploaded: z.boolean(),
    selfieUploaded: z.literal(true),
  })
  .superRefine((data, ctx) => {
    if (
      DOCUMENT_TYPES_REQUIRING_BACK.has(data.documentType) &&
      !data.documentBackUploaded
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["documentBackUploaded"],
        message: "Back of document is required for this document type",
      });
    }
  });

export const getPrimaryWallet = base
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/users/wallet",
    summary: "Get the authenticated user's primary wallet",
    tags: ["Users"],
  })
  .output(
    z.object({
      walletId: z.string(),
      address: z.string(),
      networkId: z.number(),
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
    const { walletId, address, networkId } = result.value;
    logger.info({ userId }, "User primary wallet fetched");
    return {
      walletId: walletId.toString(),
      address,
      networkId,
    };
  });

export const submitKyc = base
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/users/kyc/submit",
    summary: "Submit KYC identity verification request",
    description:
      "Submits KYC form data and sets user status to PENDING. Documents will be reviewed within 1-2 business days.",
    tags: ["Users"],
  })
  .input(kycSubmissionInputSchema)
  .output(z.object({ message: z.string() }))
  .handler(async ({ context, input }) => {
    const userId = context.session?.userId;

    if (!userId) {
      logger.warn("submitKyc called without authenticated session");
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    const result = await userService.submitKyc(BigInt(userId), input);
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    // logger.info(
    //   {
    //     userId,
    //     nationality: input.nationality,
    //     documentType: input.documentType,
    //   },
    //   "User successfully submitted KYC request"
    // );
    logger.info("User successfully submitted KYC request");
    return result.value;
  });

export const simulateKyc = base
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/users/kyc/simulate",
    summary: "Simulate KYC identity verification",
    tags: ["Users"],
  })
  .output(z.object({ message: z.string() }))
  .handler(async ({ context }) => {
    const userId = context.session?.userId;

    // Explicit auth check (requireAuth middleware should already enforce this,
    // but we validate again to fail fast with clear error)
    if (!userId) {
      logger.warn("simulateKyc called without authenticated session");
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    const result = await userService.simulateKyc(BigInt(userId));
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    logger.info({ userId }, "User successfully completed KYC simulation");
    return result.value;
  });
