import { errAsync, type ResultAsync } from "neverthrow";
import type { AppError } from "@/common/errors/base";
import {
  BlacklistAddressAlreadyBlacklistedError,
  BlacklistEntryNotFoundError,
} from "@/common/errors/compliance";
import type { Database } from "../db";
import { BlacklistRepository } from "../repositories/blacklist.repository";
import { AuditService } from "./audit.service";
import {
  blacklistAddress,
  seizeAddressTokens,
  unblacklistAddress,
} from "./blockchain";
import { logger } from "../lib/logger";

type AddInput = {
  address: string;
  networkId: number;
  reason: string;
  source?: string;
  addedByUserId: bigint;
};

export class BlacklistService {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  list(filters: {
    networkId?: number;
    search?: string;
    page: number;
    pageSize: number;
  }) {
    return new BlacklistRepository(this.db).list(filters);
  }

  add(input: AddInput): ResultAsync<void, AppError> {
    const repo = new BlacklistRepository(this.db);
    const auditService = new AuditService(this.db);

    return repo
      .findByAddress(input.address, input.networkId)
      .andThen((existing) => {
        if (existing) {
          return errAsync(
            new BlacklistAddressAlreadyBlacklistedError(input.address)
          );
        }
        return blacklistAddress(input.address).andThen((txHash) =>
          repo.create(input).map((entry) => {
            void auditService
              .log({
                userId: input.addedByUserId,
                action: "blacklist.add",
                entityType: "blacklisted_address",
                entityId: entry.id,
                newValues: {
                  address: input.address,
                  reason: input.reason,
                  txHash,
                },
              })
              .mapErr((err) => {
                logger.error({ err }, "Audit log failed for blacklist.add");
              });
          })
        );
      });
  }

  remove(
    publicId: string,
    removedByUserId: bigint
  ): ResultAsync<void, AppError> {
    const repo = new BlacklistRepository(this.db);
    const auditService = new AuditService(this.db);

    return repo.findByPublicId(publicId).andThen((entry) => {
      if (!entry) {
        return errAsync(new BlacklistEntryNotFoundError(publicId));
      }
      return repo.deleteByPublicId(publicId).andThen(() =>
        unblacklistAddress(entry.address).map((txHash) => {
          void auditService
            .log({
              userId: removedByUserId,
              action: "blacklist.remove",
              entityType: "blacklisted_address",
              entityId: entry.id,
              oldValues: { address: entry.address },
              newValues: { txHash },
            })
            .mapErr((err) => {
              logger.error({ err }, "Audit log failed for blacklist.remove");
            });
        })
      );
    });
  }

  seize(
    publicId: string,
    treasuryAddress: string,
    adminUserId: bigint
  ): ResultAsync<void, AppError> {
    const repo = new BlacklistRepository(this.db);
    const auditService = new AuditService(this.db);

    return repo.findByPublicId(publicId).andThen((entry) => {
      if (!entry) {
        return errAsync(new BlacklistEntryNotFoundError(publicId));
      }
      return seizeAddressTokens(entry.address, treasuryAddress).map(
        (txHash) => {
          void auditService
            .log({
              userId: adminUserId,
              action: "blacklist.seize",
              entityType: "blacklisted_address",
              entityId: entry.id,
              metadata: {
                fromAddress: entry.address,
                toAddress: treasuryAddress,
                txHash,
              },
            })
            .mapErr((err) => {
              logger.error({ err }, "Audit log failed for blacklist.seize");
            });
        }
      );
    });
  }
}
