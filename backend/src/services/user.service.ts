import type { ResultAsync } from "neverthrow";
import type { AppError } from "@/common/errors/base";
import { KYC_STATUS } from "../constants/kyc-status";
import type { Database } from "../db";
import { withTransaction } from "../lib/transaction";
import { UserRepository } from "../repositories/user.repository";

export class UserService {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  simulateKyc(userId: bigint): ResultAsync<{ message: string }, AppError> {
    return withTransaction(this.db, (tx) =>
      new UserRepository(tx).updateKycStatus(userId, KYC_STATUS.VERIFIED)
    ).map(() => ({ message: "Identity verified successfully." }));
  }
}
