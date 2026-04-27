import { errAsync, ResultAsync } from "neverthrow";
import type { AppError } from "@/common/errors/base";
import { InternalError } from "@/common/errors/infrastructure";
import { KYC_STATUS } from "../constants/kyc-status";
import type { Database } from "../db";
import type { KycSubmission } from "../db/schema/kyc-submissions";
import { KycRepository } from "../repositories/kyc.repository";
import { UserRepository } from "../repositories/user.repository";
import { AuditService } from "./audit.service";
import { generateDownloadUrl } from "./r2.service";

type ListFilters = {
  kycStatusId?: number;
  search?: string;
  page: number;
  pageSize: number;
};

export class KycAdminService {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  listSubmissions(filters: ListFilters) {
    return new KycRepository(this.db).listWithUser(filters);
  }

  getSubmission(publicId: string): ResultAsync<
    {
      submission: KycSubmission;
      documentFrontUrl: string | null;
      documentBackUrl: string | null;
      selfieUrl: string | null;
    },
    AppError
  > {
    return new KycRepository(this.db)
      .findByPublicId(publicId)
      .andThen((submission) => {
        if (!submission) {
          return errAsync(
            new InternalError("KYC submission not found", {
              context: { publicId },
            })
          );
        }
        return ResultAsync.fromPromise(
          Promise.all([
            submission.documentFrontKey
              ? generateDownloadUrl(submission.documentFrontKey)
              : Promise.resolve(null),
            submission.documentBackKey
              ? generateDownloadUrl(submission.documentBackKey)
              : Promise.resolve(null),
            submission.selfieKey
              ? generateDownloadUrl(submission.selfieKey)
              : Promise.resolve(null),
          ]),
          (e): InternalError =>
            new InternalError("Failed to generate document download URLs", {
              cause: e,
            })
        ).map(([documentFrontUrl, documentBackUrl, selfieUrl]) => ({
          submission,
          documentFrontUrl,
          documentBackUrl,
          selfieUrl,
        }));
      });
  }

  approve(
    publicId: string,
    reviewerUserId: bigint
  ): ResultAsync<void, AppError> {
    const kycRepo = new KycRepository(this.db);
    const userRepo = new UserRepository(this.db);
    const auditService = new AuditService(this.db);

    return kycRepo.findByPublicId(publicId).andThen((submission) => {
      if (!submission) {
        return errAsync(
          new InternalError("KYC submission not found", {
            context: { publicId },
          })
        );
      }
      return kycRepo
        .updateSubmissionReview(submission.id, {
          kycStatusId: KYC_STATUS.VERIFIED,
          reviewedByUserId: reviewerUserId,
        })
        .andThen(() =>
          userRepo.updateKycStatus(submission.userId, KYC_STATUS.VERIFIED)
        )
        .andThen(() =>
          auditService.log({
            userId: reviewerUserId,
            action: "kyc.approve",
            entityType: "kyc_submission",
            entityId: submission.id,
            oldValues: { kycStatusId: submission.kycStatusId },
            newValues: { kycStatusId: KYC_STATUS.VERIFIED },
          })
        );
    });
  }

  reject(
    publicId: string,
    reviewerUserId: bigint,
    reason: string
  ): ResultAsync<void, AppError> {
    const kycRepo = new KycRepository(this.db);
    const userRepo = new UserRepository(this.db);
    const auditService = new AuditService(this.db);

    return kycRepo.findByPublicId(publicId).andThen((submission) => {
      if (!submission) {
        return errAsync(
          new InternalError("KYC submission not found", {
            context: { publicId },
          })
        );
      }
      return kycRepo
        .updateSubmissionReview(submission.id, {
          kycStatusId: KYC_STATUS.REJECTED,
          reviewedByUserId: reviewerUserId,
          rejectionReason: reason,
        })
        .andThen(() =>
          userRepo.updateKycStatus(submission.userId, KYC_STATUS.REJECTED)
        )
        .andThen(() =>
          auditService.log({
            userId: reviewerUserId,
            action: "kyc.reject",
            entityType: "kyc_submission",
            entityId: submission.id,
            oldValues: { kycStatusId: submission.kycStatusId },
            newValues: {
              kycStatusId: KYC_STATUS.REJECTED,
              rejectionReason: reason,
            },
          })
        );
    });
  }
}
