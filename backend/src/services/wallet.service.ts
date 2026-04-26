import { and, eq, isNull } from "drizzle-orm";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import type { AppError } from "@/common/errors/base";
import { InternalError } from "@/common/errors/infrastructure";
import { WalletNotFoundError } from "@/common/errors/wallet";
import type { Database } from "../db";
import { networks } from "../db/schema/networks";
import { type Wallet, wallets } from "../db/schema/wallets";
import { encrypt } from "../lib/encryption";
import { logger } from "../lib/logger";
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

  provisionCustodialWallet(userId: bigint): ResultAsync<Wallet, AppError> {
    return ResultAsync.fromPromise(
      this.db
        .select()
        .from(networks)
        .where(eq(networks.isActive, true))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      (e): AppError =>
        new InternalError("Failed to query active network", { cause: e })
    ).andThen((network) => {
      if (!network) {
        return errAsync(
          new InternalError("No active network found for wallet provisioning")
        );
      }

      return ResultAsync.fromPromise(
        this.db
          .select()
          .from(wallets)
          .where(
            and(
              eq(wallets.userId, userId),
              eq(wallets.networkId, network.id),
              eq(wallets.isPrimary, true),
              isNull(wallets.deletedAt)
            )
          )
          .limit(1)
          .then((rows) => rows[0] ?? null),
        (e): AppError =>
          new InternalError("Failed to check existing primary wallet", {
            cause: e,
          })
      ).andThen((existing) => {
        if (existing) {
          logger.warn(
            { userId: userId.toString(), walletId: existing.id.toString() },
            "User already has a primary wallet — skipping provisioning"
          );
          return okAsync(existing);
        }

        let privateKey: `0x${string}`;
        let address: string;
        try {
          privateKey = generatePrivateKey();
          address = privateKeyToAccount(privateKey).address;
        } catch (e) {
          return errAsync(
            new InternalError("Failed to generate Ethereum keypair", {
              cause: e,
            })
          );
        }

        let encryptedPrivateKey: string;
        try {
          encryptedPrivateKey = encrypt(privateKey);
        } catch (e) {
          return errAsync(
            new InternalError(
              "Failed to encrypt private key — MASTER_ENCRYPTION_KEY may not be set",
              { cause: e }
            )
          );
        }

        return new WalletRepository(this.db).create({
          userId,
          networkId: network.id,
          address,
          walletType: "CUSTODIAL",
          isPrimary: true,
          encryptedPrivateKey,
          providerName: "internal",
        });
      });
    });
  }
}
