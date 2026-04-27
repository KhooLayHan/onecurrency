import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import z from "zod";
import { db } from "@/src/db";
import { roles } from "@/src/db/schema/roles";
import { userRoles } from "@/src/db/schema/user-roles";
import { logger } from "@/src/lib/logger";
import { KycRepository } from "@/src/repositories/kyc.repository";
import { UserRepository } from "@/src/repositories/user.repository";
import * as r2 from "@/src/services/r2.service";
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
    documentFrontKey: z.string().min(1, "Front document is required"),
    documentBackKey: z.string().default(""),
    selfieKey: z.string().min(1, "Selfie is required"),
  })
  .superRefine((data, ctx) => {
    if (
      DOCUMENT_TYPES_REQUIRING_BACK.has(data.documentType) &&
      !data.documentBackKey
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["documentBackKey"],
        message: "Back of document is required for this document type",
      });
    }
  });

export const getPrimaryWallet = base
  .use(requireAuth)
  // .route({
  //   method: "GET",
  //   // path: "/users/wallet",
  //   summary: "Get the authenticated user's primary wallet",
  //   tags: ["Users"],
  // })
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
    // path: "/users/kyc/submit",
    summary: "Submit KYC identity verification request",
    description:
      "Submits KYC form data and sets user status to PENDING. Documents will be reviewed within 1-2 business days.",
    tags: ["Users"],
  })
  .input(kycSubmissionInputSchema)
  .output(z.object({ message: z.string() }))
  .handler(async ({ context, input }) => {
    const userId = context.session?.userId;

    logger.info(
      {
        input,
        dateOfBirthType: typeof input.dateOfBirth,
        dateOfBirthValue: input.dateOfBirth,
      },
      "submitKyc received raw input"
    );

    logger.info({ context }, "submitKyc received input");
    logger.info({ userId }, "submitKyc received input");
    logger.info({ input }, "submitKyc received input");
    if (!userId) {
      logger.warn("submitKyc called without authenticated session");
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    const result = await userService.submitKyc(BigInt(userId), {
      fullName: input.fullName,
      dateOfBirth: new Date(input.dateOfBirth),
      nationality: input.nationality,
      documentType: input.documentType,
      documentFrontKey: input.documentFrontKey,
      documentBackKey: input.documentBackKey,
      selfieKey: input.selfieKey,
    });
    if (result.isErr()) {
      logger.info({ context }, "submitKyc received input here failed");
      throw mapToORPCError(result.error);
    }
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

    const userRepo = new UserRepository(db);
    const result = await userRepo.findByEmail(input.email);
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }

    const recipient = result.value;
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

const FILE_TYPE_TO_PREFIX: Record<string, string> = {
  front: "kyc/documents/front",
  back: "kyc/documents/back",
  selfie: "kyc/selfies",
};

export const getKycUploadUrl = base
  .use(requireAuth)
  .input(
    z.object({
      fileType: z.enum(["front", "back", "selfie"]),
      contentType: z
        .string()
        .regex(/^image\/(jpeg|png|webp|heic)|application\/pdf$/),
    })
  )
  .output(z.object({ uploadUrl: z.string(), key: z.string() }))
  .handler(async ({ context, input }) => {
    const userId = context.session.userId;
    const ext = input.contentType.includes("pdf")
      ? "pdf"
      : input.contentType.split("/")[1];
    const key = `${FILE_TYPE_TO_PREFIX[input.fileType]}/${userId}/${Date.now()}.${ext}`;
    const uploadUrl = await r2.generateUploadUrl(key, input.contentType);
    return { uploadUrl, key };
  });

export const getLatestKycSubmission = base
  .use(requireAuth)
  .output(
    z
      .object({
        rejectionReason: z.string().nullable(),
      })
      .nullable()
  )
  .handler(async ({ context }) => {
    const userId = context.session.userId;
    const result = await new KycRepository(db).findLatestByUserId(
      BigInt(userId)
    );
    if (result.isErr()) {
      return null;
    }
    const submission = result.value;
    if (!submission) {
      return null;
    }
    return { rejectionReason: submission.rejectionReason ?? null };
  });

export const getMyRoles = base
  .use(requireAuth)
  .output(z.array(z.string()))
  .handler(async ({ context }) => {
    const rows = await db
      .select({ name: roles.name })
      .from(userRoles)
      .innerJoin(roles, eq(userRoles.roleId, roles.id))
      .where(eq(userRoles.userId, BigInt(context.session.userId)));
    return rows.map((r) => r.name);
  });
