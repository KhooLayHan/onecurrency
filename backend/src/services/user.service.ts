import type { ResultAsync } from "neverthrow";
import { errAsync } from "neverthrow";
import type { AppError } from "@/common/errors/base";
import {
  KycAlreadyVerifiedError,
  KycPendingError,
} from "@/common/errors/compliance";
import { UserNotFoundError } from "@/common/errors/user";
import { KYC_STATUS } from "../constants/kyc-status";
import type { Database } from "../db";
import { logger } from "../lib/logger";
import { withTransaction } from "../lib/transaction";
import { KycRepository } from "../repositories/kyc.repository";
import { UserRepository } from "../repositories/user.repository";

export type KycSubmissionData = {
  fullName: string;
  dateOfBirth: Date;
  nationality: string;
  documentType: "passport" | "drivers_license" | "national_id";
  documentFrontKey: string;
  documentBackKey: string;
  selfieKey: string;
};

export class UserService {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  submitKyc(
    userId: bigint,
    data: KycSubmissionData
  ): ResultAsync<{ message: string }, AppError> {
    return new UserRepository(this.db).findById(userId).andThen((user) => {
      if (user === null) {
        return errAsync(new UserNotFoundError(userId.toString()));
      }

      logger.warn("dada");

      if (user.kycStatusId === KYC_STATUS.PENDING) {
        // If already PENDING, fetch the submission record for accurate timestamp
        return new KycRepository(this.db)
          .findLatestByUserId(userId)
          .andThen((submission) => {
            const submittedAt =
              submission?.createdAt.toISOString() ??
              user.updatedAt?.toISOString() ??
              new Date().toISOString();
            return errAsync(new KycPendingError(submittedAt));
          });
      }

      if (user.kycStatusId === KYC_STATUS.VERIFIED) {
        // Check for other blocking statuses
        return errAsync(new KycAlreadyVerifiedError());
      }

      // Check current KYC status and prevent duplicate submissions
      switch (user.kycStatusId) {
        case KYC_STATUS.PENDING:
          return errAsync(
            new KycPendingError(
              user.updatedAt?.toISOString() ?? new Date().toISOString()
            )
          );
        case KYC_STATUS.VERIFIED:
          return errAsync(new KycAlreadyVerifiedError());
        default:
        // For NONE, REJECTED, or EXPIRED - allow submission below
      }

      // Persist the submission record and update the user status atomically
      return withTransaction(this.db, (tx) =>
        new KycRepository(tx)
          .createSubmission({
            userId,
            kycStatusId: KYC_STATUS.PENDING,
            fullName: data.fullName,
            dateOfBirth: data.dateOfBirth,
            nationality: data.nationality,
            documentType: data.documentType,
            documentFrontKey: data.documentFrontKey,
            documentBackKey: data.documentBackKey || undefined,
            selfieKey: data.selfieKey,
          })
          .andThen(() =>
            new UserRepository(tx).updateKycStatus(userId, KYC_STATUS.PENDING)
          )
      ).map(() => ({
        message:
          "Verification submitted. We'll review your documents within 1-2 business days.",
      }));
    });
  }

  simulateKyc(userId: bigint): ResultAsync<
    {
      message: string;
    },
    AppError
  > {
    return withTransaction(this.db, (tx) =>
      new UserRepository(tx).updateKycStatus(userId, KYC_STATUS.VERIFIED)
    ).map(() => ({ message: "Identity verified successfully." }));
  }
}
