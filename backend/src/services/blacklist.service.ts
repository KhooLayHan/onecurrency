import { errAsync, type ResultAsync } from "neverthrow";
import type { AppError } from "@/common/errors/base";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../db";
import { BlacklistRepository } from "../repositories/blacklist.repository";
import { AuditService } from "./audit.service";
import {
  blacklistAddress,
  seizeAddressTokens,
  unblacklistAddress,
} from "./blockchain";

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
            new InternalError("Address is already blacklisted", {
              context: { address: input.address },
            })
          );
        }
        return repo.create(input).andThen((entry) =>
          blacklistAddress(input.address).andThen((txHash) =>
            auditService.log({
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
          )
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
        return errAsync(
          new InternalError("Blacklist entry not found", {
            context: { publicId },
          })
        );
      }
      return unblacklistAddress(entry.address).andThen((txHash) =>
        repo.deleteByPublicId(publicId).andThen(() =>
          auditService.log({
            userId: removedByUserId,
            action: "blacklist.remove",
            entityType: "blacklisted_address",
            entityId: entry.id,
            oldValues: { address: entry.address },
            newValues: { txHash },
          })
        )
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
        return errAsync(
          new InternalError("Blacklist entry not found", {
            context: { publicId },
          })
        );
      }
      return seizeAddressTokens(entry.address, treasuryAddress).andThen(
        (txHash) =>
          auditService.log({
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
      );
    });
  }
}
