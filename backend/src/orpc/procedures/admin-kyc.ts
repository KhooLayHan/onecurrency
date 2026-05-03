/**
 * Admin KYC procedures.
 *
 * Exposes four oRPC procedures for reviewing KYC identity submissions:
 *
 * - `listKycSubmissions` — paginated list with optional status and text filters.
 * - `getKycSubmission`   — full detail for a single submission including signed
 *                          document/selfie URLs from R2.
 * - `approveKyc`         — marks a submission as approved and records the reviewer.
 * - `rejectKyc`          — marks a submission as rejected with a mandatory reason.
 *
 * All procedures require the `kyc:read` or `kyc:verify` / `kyc:reject`
 * permissions enforced by the `requirePermission` middleware.
 */

import z from "zod";
import { db } from "@/src/db";
import { KycAdminService } from "@/src/services/kyc-admin.service";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requirePermission } from "../middleware";

const kycAdminService = new KycAdminService(db);

/** Number of KYC submissions returned per page. */
const KYC_PAGE_SIZE = 20;

/**
 * Lists KYC submissions with optional filtering by status and text search.
 *
 * @permission kyc:read
 * @input  page        - 1-based page number (default 1).
 * @input  kycStatusId - Optional status ID to filter by.
 * @input  search      - Optional text to search across name / email fields.
 * @output Paginated list of submission summaries.
 */
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

/**
 * Returns the full detail for a single KYC submission, including signed
 * pre-signed URLs for the uploaded document and selfie images.
 *
 * @permission kyc:read
 * @input  publicId - UUID of the KYC submission to retrieve.
 * @output Submission fields plus nullable document/selfie URLs.
 */
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

/**
 * Approves a pending KYC submission, recording the reviewing admin's user ID.
 *
 * @permission kyc:verify
 * @input  publicId - UUID of the submission to approve.
 * @output Confirmation message.
 */
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

/**
 * Rejects a pending KYC submission with a mandatory human-readable reason.
 * The reason is stored and surfaced to the user in their profile.
 *
 * @permission kyc:reject
 * @input  publicId - UUID of the submission to reject.
 * @input  reason   - Explanation shown to the user (min 10 characters).
 * @output Confirmation message.
 */
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
