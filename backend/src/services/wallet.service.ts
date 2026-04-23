import type { ResultAsync } from "neverthrow";
import { errAsync, okAsync } from "neverthrow";
import type { AppError } from "@/common/errors/base";
import { WalletNotFoundError } from "@/common/errors/wallet";
import type { Database } from "../db";
import { WalletRepository } from "../repositories/wallet.repository";

export type PrimaryWallet = {
  walletId: bigint;
  address: string;
  networkId: number;
};

export class WalletService {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  getUserPrimaryWallet(userId: bigint): ResultAsync<PrimaryWallet, AppError> {
    return new WalletRepository(this.db)
      .findPrimaryByUserId(userId)
      .andThen((wallet) => {
        if (!wallet) {
          return errAsync(
            new WalletNotFoundError("primary", {
              context: { userId: userId.toString() },
            })
          );
        }

        return okAsync({
          walletId: wallet.id,
          address: wallet.address,
          networkId: wallet.networkId,
        });
      });
  }
}
