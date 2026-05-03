/**
 * User-facing KYC procedures.
 *
 * Handles everything a regular authenticated user can do with their own KYC
 * identity verification:
 *
 * - `getKycUploadUrl`        — generates a short-lived pre-signed R2 upload URL
 *                              for a document or selfie file.
 * - `submitKyc`              — validates uploaded file keys, confirms the objects
 *                              exist in R2, and creates the KYC submission record.
 * - `simulateKyc`            — dev/staging helper that auto-approves the user's
 *                              KYC without a real review (gated by env).
 * - `getLatestKycSubmission` — returns the rejection reason for the user's most
 *                              recent submission (used to surface feedback in UI).
 *
 * All procedures require an authenticated session via the `requireAuth` middleware.
 */
import { ORPCError } from "@orpc/server";
import z from "zod";
import { db } from "@/src/db";
import { env } from "@/src/env";
import { logger } from "@/src/lib/logger";
import { KycRepository } from "@/src/repositories/kyc.repository";
import {
  checkObjectExists,
  generateUploadUrl,
} from "@/src/services/r2.service";
import { UserService } from "@/src/services/user.service";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requireAuth } from "../middleware";

const userService = new UserService(db);

/**
 * Document types that legally require a photograph of both sides.
 * Passports only have one relevant side, so they are excluded.
 */
const DOCUMENT_TYPES_REQUIRING_BACK = new Set([
  "drivers_license",
  "national_id",
]);

/**
 * Maps R2 file type identifiers to their storage path prefixes.
 * The `userId` segment is inserted at upload time to scope files per user.
 */
const FILE_TYPE_TO_PREFIX: Record<string, string> = {
  front: "kyc/documents/front",
  back: "kyc/documents/back",
  selfie: "kyc/selfies",
};

/**
 * Zod schema for the KYC submission body.
 * Mirrors `KycFormData` on the frontend and enforces the back-document
 * requirement for applicable document types via `superRefine`.
 */
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

/**
 * Generates a short-lived pre-signed R2 URL the client can use to upload
 * a KYC document or selfie directly to object storage.
 *
 * The storage key is constructed as `<prefix>/<userId>/<timestamp>.<ext>` to
 * namespace uploads per user and prevent path collisions.
 *
 * @auth   requireAuth
 * @input  fileType    - Which file slot to generate a URL for ("front" | "back" | "selfie").
 * @input  contentType - MIME type of the file being uploaded. Selfies cannot be PDFs.
 * @output uploadUrl   - Pre-signed PUT URL (valid for a short window).
 * @output key         - The R2 object key to pass back in `submitKyc`.
 */
export const getKycUploadUrl = base
  .use(requireAuth)
  .input(
    z
      .object({
        fileType: z.enum(["front", "back", "selfie"]),
        contentType: z
          .string()
          .regex(/^(image\/(jpeg|png|webp|heic)|application\/pdf)$/),
      })
      .superRefine(({ fileType, contentType }, ctx) => {
        if (fileType === "selfie" && contentType === "application/pdf") {
          ctx.addIssue({
            code: "custom",
            path: ["contentType"],
            message: "Selfie uploads must use an image content type",
          });
        }
      })
  )
  .output(z.object({ uploadUrl: z.string(), key: z.string() }))
  .handler(async ({ context, input }) => {
    const userId = context.session.userId;

    const CONTENT_TYPE_TO_EXT: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
      "application/pdf": "pdf",
    };

    const ext = CONTENT_TYPE_TO_EXT[input.contentType] ?? "bin";
    const key = `${FILE_TYPE_TO_PREFIX[input.fileType]}/${userId}/${Date.now()}.${ext}`;
    const uploadUrl = await generateUploadUrl(key, input.contentType);
    return { uploadUrl, key };
  });

/**
 * Submits the user's KYC request after validating that all uploaded files
 * exist in R2 and their storage keys match the expected path prefixes.
 *
 * Key prefix validation prevents a user from referencing another user's
 * uploaded documents by guessing their storage path.
 *
 * @auth   requireAuth
 * @input  kycSubmissionInputSchema fields (see schema definition above).
 * @output Confirmation message.
 */
export const submitKyc = base
  .use(requireAuth)
  .route({
    method: "POST",
    summary: "Submit KYC identity verification request",
    description:
      "Submits KYC form data and sets user status to PENDING. Documents will be reviewed within 1-2 business days.",
    tags: ["Users"],
  })
  .input(kycSubmissionInputSchema)
  .output(z.object({ message: z.string() }))
  .handler(async ({ context, input }) => {
    const userId = context.session?.userId;

    // Log only non-sensitive metadata — never log PII such as name, DOB,
    // nationality, or storage keys.
    logger.info(
      { userId, documentType: input.documentType },
      "submitKyc received request"
    );

    if (!userId) {
      logger.warn("submitKyc called without authenticated session");
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    // Each uploaded key must belong to the requesting user's namespace to
    // prevent document substitution attacks.
    const EXPECTED_PREFIXES = {
      documentFrontKey: `kyc/documents/front/${userId}/`,
      documentBackKey: `kyc/documents/back/${userId}/`,
      selfieKey: `kyc/selfies/${userId}/`,
    } as const;

    const keysToValidate = [
      {
        key: input.documentFrontKey,
        field: "documentFrontKey",
        prefix: EXPECTED_PREFIXES.documentFrontKey,
      },
      {
        key: input.selfieKey,
        field: "selfieKey",
        prefix: EXPECTED_PREFIXES.selfieKey,
      },
      ...(input.documentBackKey
        ? [
            {
              key: input.documentBackKey,
              field: "documentBackKey",
              prefix: EXPECTED_PREFIXES.documentBackKey,
            },
          ]
        : []),
    ];

    for (const { key, field, prefix } of keysToValidate) {
      if (!key.startsWith(prefix)) {
        throw new ORPCError("BAD_REQUEST", {
          message: `Invalid storage key for ${field}`,
        });
      }
    }

    // Confirm the files are actually present in R2 before creating the DB record
    const existenceChecks = await Promise.all(
      keysToValidate.map(({ key }) => checkObjectExists(key))
    );
    if (existenceChecks.some((exists) => !exists)) {
      throw new ORPCError("BAD_REQUEST", {
        message:
          "One or more document files could not be found. Please re-upload and try again.",
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
      throw mapToORPCError(result.error);
    }

    logger.info("User successfully submitted KYC request");
    return result.value;
  });

/**
 * Dev/staging-only helper that auto-approves the calling user's KYC without
 * a manual review, allowing end-to-end testing of post-KYC flows.
 *
 * @auth   requireAuth
 * @output Confirmation message.
 */
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

    // Explicit auth check — requireAuth should already enforce this, but we
    // validate again to fail fast with a clear message if the middleware changes.
    if (!userId) {
      logger.warn("simulateKyc called without authenticated session");
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    // This endpoint must never run in production — it bypasses the KYC review
    // process entirely and is intended only for development and staging.
    if (env.NODE_ENV === "production") {
      throw new ORPCError("FORBIDDEN", {
        message: "This endpoint is not available in production",
      });
    }

    const result = await userService.simulateKyc(BigInt(userId));
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }

    logger.info({ userId }, "User successfully completed KYC simulation");
    return result.value;
  });

/**
 * Returns the rejection reason for the user's most recent KYC submission.
 *
 * Used by the profile page to surface feedback when a previous submission
 * was rejected. Returns `null` if the user has no submissions on record.
 *
 * @auth   requireAuth
 * @output Object with `rejectionReason`, or `null` if no submission exists.
 */
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
      throw mapToORPCError(result.error);
    }
    const submission = result.value;
    if (!submission) {
      return null;
    }
    return { rejectionReason: submission.rejectionReason ?? null };
  });
