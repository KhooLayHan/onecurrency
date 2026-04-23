import { ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../db";
import {
  type NewKycSubmission,
  kycSubmissions,
} from "../db/schema/kyc-submissions";

type CreateSubmissionInput = {
  userId: bigint;
  kycStatusId: bigint;
  fullName: string;
  dateOfBirth: Date;
  nationality: string;
  documentType: string;
};

export class KycRepository {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  createSubmission(
    input: CreateSubmissionInput
  ): ResultAsync<void, InternalError> {
    const record: NewKycSubmission = {
      userId: input.userId,
      kycStatusId: input.kycStatusId,
      fullName: input.fullName,
      // date columns expect a string in YYYY-MM-DD format
      dateOfBirth: input.dateOfBirth.toISOString().slice(0, 10),
      nationality: input.nationality,
      documentType: input.documentType,
    };

    return ResultAsync.fromPromise(
      this.db
        .insert(kycSubmissions)
        .values(record)
        .then((): void => {
          // resolves to void — no return value needed from insert
        }),
      (e): InternalError =>
        new InternalError("Failed to create KYC submission record", {
          cause: e,
          context: { userId: input.userId.toString() },
        })
    );
  }
}
