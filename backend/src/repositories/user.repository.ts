import { eq } from "drizzle-orm";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import { UserNotFoundError } from "@/common/errors/user";
import type { KycStatusId } from "../constants/kyc-status";
import type { Database } from "../db";
import { type User, users } from "../db/schema/users";

export class UserRepository {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  findById(id: bigint): ResultAsync<User | null, InternalError> {
    return ResultAsync.fromPromise(
      this.db._query.users
        .findFirst({ where: eq(users.id, id) })
        .then((user) => user ?? null),
      (e): InternalError =>
        new InternalError("Failed to fetch user from database", {
          cause: e,
          context: { userId: id.toString() },
        })
    ).map((user) => user ?? null);
  }

  updateKycStatus(
    id: bigint,
    statusId: KycStatusId
  ): ResultAsync<void, UserNotFoundError | InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .update(users)
        .set({
          kycStatusId: statusId,
          updatedAt: new Date(),
        })
        .where(eq(users.id, id))
        .returning({ id: users.id }),
      (e): InternalError =>
        new InternalError("Failed to update user KYC status", {
          cause: e,
          context: { userId: id.toString(), statusId },
        })
    ).andThen((rows) => {
      if (rows.length === 0) {
        return errAsync(new UserNotFoundError(id.toString()));
      }
      return okAsync(undefined);
    });
  }

  updateStripeConnectAccountId(
    id: bigint,
    stripeConnectAccountId: string
  ): ResultAsync<void, InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .update(users)
        .set({ stripeConnectAccountId, updatedAt: new Date() })
        .where(eq(users.id, id)),
      (e): InternalError =>
        new InternalError("Failed to save Stripe Connect account ID", {
          cause: e,
          context: { userId: id.toString() },
        })
    ).andThen(() => okAsync(undefined));
  }
}
