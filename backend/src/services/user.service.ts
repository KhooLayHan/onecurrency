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
import { withTransaction } from "../lib/transaction";
import { UserRepository } from "../repositories/user.repository";

export type KycSubmissionData = {
  fullName: string;
  dateOfBirth: Date;
  nationality: string;
  documentType: "passport" | "drivers_license" | "national_id";
  documentFrontUploaded: boolean;
  documentBackUploaded: boolean;
  selfieUploaded: boolean;
};

export class UserService {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  submitKyc(
    userId: bigint,
    _data: KycSubmissionData
  ): ResultAsync<{ message: string }, AppError> {
    return new UserRepository(this.db).findById(userId).andThen((user) => {
      if (user === null) {
        return errAsync(new UserNotFoundError(userId.toString()));
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
        // For NONE, REJECTED, or EXPIRED - allow submission and set to PENDING below
      }

      // For NONE, REJECTED, or EXPIRED - allow submission and set to PENDING
      return withTransaction(this.db, (tx) =>
        new UserRepository(tx).updateKycStatus(userId, KYC_STATUS.PENDING)
      ).map(() => ({
        message:
          "Verification submitted. We'll review your documents within 1-2 business days.",
      }));
    });
  }

  simulateKyc(userId: bigint): ResultAsync<{ message: string }, AppError> {
    return withTransaction(this.db, (tx) =>
      new UserRepository(tx).updateKycStatus(userId, KYC_STATUS.VERIFIED)
    ).map(() => ({ message: "Identity verified successfully." }));
  }
}
