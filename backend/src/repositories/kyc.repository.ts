import { desc, eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../db";
import {
  type KycSubmission,
  kycSubmissions,
  type NewKycSubmission,
} from "../db/schema/kyc-submissions";

type CreateSubmissionInput = {
  userId: bigint;
  kycStatusId: number;
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

  findLatestByUserId(
    userId: bigint
  ): ResultAsync<KycSubmission | null, InternalError> {
    return ResultAsync.fromPromise(
      this.db._query.kycSubmissions.findFirst({
        where: eq(kycSubmissions.userId, userId),
        orderBy: desc(kycSubmissions.id),
      }),
      (e): InternalError =>
        new InternalError("Failed to fetch latest KYC submission", {
          cause: e,
          context: { userId: userId.toString() },
        })
    ).map((submission) => submission ?? null);
  }
}
