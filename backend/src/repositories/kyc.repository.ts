import { and, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../db";
import {
  type KycSubmission,
  kycSubmissions,
  type NewKycSubmission,
} from "../db/schema/kyc-submissions";
import { users } from "../db/schema/users";

type CreateSubmissionInput = {
  userId: bigint;
  kycStatusId: number;
  fullName: string;
  dateOfBirth: Date;
  nationality: string;
  documentType: string;
  documentFrontKey?: string;
  documentBackKey?: string;
  selfieKey?: string;
};

type ListFilters = {
  kycStatusId?: number;
  search?: string;
  page: number;
  pageSize: number;
};

export type KycSubmissionWithUser = KycSubmission & {
  userEmail: string;
  userName: string;
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
      dateOfBirth: [
        input.dateOfBirth.getFullYear(),
        String(input.dateOfBirth.getMonth() + 1).padStart(2, "0"),
        String(input.dateOfBirth.getDate()).padStart(2, "0"),
      ].join("-"),
      nationality: input.nationality,
      documentType: input.documentType,
      documentFrontKey: input.documentFrontKey,
      documentBackKey: input.documentBackKey,
      selfieKey: input.selfieKey,
    };

    return ResultAsync.fromPromise(
      (async () => {
        await this.db.insert(kycSubmissions).values(record);
      })(),
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

  findByPublicId(
    publicId: string
  ): ResultAsync<KycSubmission | null, InternalError> {
    return ResultAsync.fromPromise(
      this.db._query.kycSubmissions.findFirst({
        where: eq(kycSubmissions.publicId, publicId),
      }),
      (e): InternalError =>
        new InternalError("Failed to fetch KYC submission by publicId", {
          cause: e,
          context: { publicId },
        })
    ).map((s) => s ?? null);
  }

  listWithUser(
    filters: ListFilters
  ): ResultAsync<
    { items: KycSubmissionWithUser[]; total: number },
    InternalError
  > {
    const conditions: SQL[] = [];
    if (filters.kycStatusId) {
      conditions.push(eq(kycSubmissions.kycStatusId, filters.kycStatusId));
    }
    if (filters.search) {
      conditions.push(
        or(
          ilike(kycSubmissions.fullName, `%${filters.search}%`),
          ilike(users.email, `%${filters.search}%`)
        ) as SQL
      );
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (filters.page - 1) * filters.pageSize;

    return ResultAsync.fromPromise(
      Promise.all([
        this.db
          .select({
            id: kycSubmissions.id,
            publicId: kycSubmissions.publicId,
            userId: kycSubmissions.userId,
            kycStatusId: kycSubmissions.kycStatusId,
            fullName: kycSubmissions.fullName,
            dateOfBirth: kycSubmissions.dateOfBirth,
            nationality: kycSubmissions.nationality,
            documentType: kycSubmissions.documentType,
            documentFrontKey: kycSubmissions.documentFrontKey,
            documentBackKey: kycSubmissions.documentBackKey,
            selfieKey: kycSubmissions.selfieKey,
            rejectionReason: kycSubmissions.rejectionReason,
            reviewedByUserId: kycSubmissions.reviewedByUserId,
            reviewedAt: kycSubmissions.reviewedAt,
            createdAt: kycSubmissions.createdAt,
            userEmail: users.email,
            userName: users.name,
          })
          .from(kycSubmissions)
          .innerJoin(users, eq(kycSubmissions.userId, users.id))
          .where(where)
          .orderBy(desc(kycSubmissions.id))
          .limit(filters.pageSize)
          .offset(offset),
        this.db
          .select({ count: sql<number>`count(*)::int` })
          .from(kycSubmissions)
          .innerJoin(users, eq(kycSubmissions.userId, users.id))
          .where(where),
      ]),
      (e): InternalError =>
        new InternalError("Failed to list KYC submissions", { cause: e })
    ).map(([items, countRows]) => ({
      items: items as KycSubmissionWithUser[],
      total: countRows[0]?.count ?? 0,
    }));
  }

  updateSubmissionReview(
    id: bigint,
    update: {
      kycStatusId: number;
      reviewedByUserId: bigint;
      rejectionReason?: string;
    }
  ): ResultAsync<void, InternalError> {
    return ResultAsync.fromPromise(
      (async () => {
        await this.db
          .update(kycSubmissions)
          .set({
            kycStatusId: update.kycStatusId,
            reviewedByUserId: update.reviewedByUserId,
            rejectionReason: update.rejectionReason ?? null,
            reviewedAt: new Date(),
          })
          .where(eq(kycSubmissions.id, id));
      })(),
      (e): InternalError =>
        new InternalError("Failed to update KYC submission review", {
          cause: e,
        })
    );
  }
}
