import { and, desc, eq, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import { TransferNotFoundError } from "@/common/errors/transfer";
import {
  TRANSACTION_STATUS,
  type TransactionStatusId,
} from "../constants/transaction-status";
import type { Database } from "../db";
import { transactionStatuses } from "../db/schema/transaction-statuses";
import {
  type NewTransfer,
  type Transfer,
  transfers,
} from "../db/schema/transfers";
import { users } from "../db/schema/users";

export type TransferHistoryItem = {
  id: string;
  publicId: string;
  type: "transfer_sent" | "transfer_received";
  amountCents: number;
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  counterpartyName: string;
  note: string | null;
  createdAt: Date;
};

const VALID_STATUSES = new Set([
  "pending",
  "processing",
  "completed",
  "failed",
  "refunded",
]);

export class TransferRepository {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  create(data: NewTransfer): ResultAsync<Transfer, InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .insert(transfers)
        .values(data)
        .returning()
        .then((rows) => rows[0]),
      (e): InternalError =>
        new InternalError("Failed to create transfer record", {
          cause: e,
          context: {
            senderUserId: data.senderUserId?.toString(),
            receiverUserId: data.receiverUserId?.toString(),
          },
        })
    ).andThen((transfer) => {
      if (!transfer) {
        return errAsync(
          new InternalError("Transfer not returned after insert", {
            context: {
              senderUserId: data.senderUserId?.toString(),
            },
          })
        );
      }
      return okAsync(transfer);
    });
  }

  complete(
    id: bigint,
    blockchainTxId: bigint
  ): ResultAsync<void, TransferNotFoundError | InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .update(transfers)
        .set({
          statusId: TRANSACTION_STATUS.COMPLETED,
          blockchainTxId,
          completedAt: new Date(),
        })
        .where(eq(transfers.id, id))
        .returning({ id: transfers.id }),
      (e): InternalError =>
        new InternalError("Failed to complete transfer", {
          cause: e,
          context: {
            transferId: id.toString(),
            blockchainTxId: blockchainTxId.toString(),
          },
        })
    ).andThen((rows) => {
      if (rows.length === 0) {
        return errAsync(new TransferNotFoundError(id.toString()));
      }
      return okAsync(undefined);
    });
  }

  updateStatus(
    id: bigint,
    statusId: TransactionStatusId
  ): ResultAsync<void, TransferNotFoundError | InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .update(transfers)
        .set({ statusId })
        .where(eq(transfers.id, id))
        .returning({ id: transfers.id }),
      (e): InternalError =>
        new InternalError("Failed to update transfer status", {
          cause: e,
          context: { transferId: id.toString(), statusId },
        })
    ).andThen((rows) => {
      if (rows.length === 0) {
        return errAsync(new TransferNotFoundError(id.toString()));
      }
      return okAsync(undefined);
    });
  }

  findByIdempotencyKey(
    senderUserId: bigint,
    idempotencyKey: string
  ): ResultAsync<Transfer | null, InternalError> {
    return ResultAsync.fromPromise(
      this.db
        .select()
        .from(transfers)
        .where(
          and(
            eq(transfers.senderUserId, senderUserId),
            eq(transfers.idempotencyKey, idempotencyKey)
          )
        )
        .limit(1)
        .then((rows) => rows[0] ?? null),
      (e): InternalError =>
        new InternalError("Failed to check idempotency key", {
          cause: e,
          context: {
            senderUserId: senderUserId.toString(),
            idempotencyKey,
          },
        })
    );
  }

  private validateAndMapRow(
    row: {
      id: bigint;
      publicId: string;
      senderUserId: bigint;
      amountCents: bigint | null;
      status: string;
      senderName: string | null;
      receiverName: string | null;
      note: string | null;
      createdAt: Date;
    },
    userId: bigint
  ):
    | { ok: true; item: TransferHistoryItem }
    | { ok: false; error: InternalError } {
    const status = row.status.toLowerCase();
    if (!VALID_STATUSES.has(status)) {
      return {
        ok: false,
        error: new InternalError("Unknown transaction status from DB", {
          context: { status: row.status },
        }),
      };
    }
    if (row.amountCents == null) {
      return {
        ok: false,
        error: new InternalError("Transfer amountCents is null in DB", {
          context: { transferId: row.id.toString() },
        }),
      };
    }
    const amountCentsNum = Number(row.amountCents);
    if (!Number.isSafeInteger(amountCentsNum)) {
      return {
        ok: false,
        error: new InternalError(
          "Transfer amountCents exceeds safe integer range",
          {
            context: {
              transferId: row.id.toString(),
              amountCents: row.amountCents.toString(),
            },
          }
        ),
      };
    }
    const isSender = row.senderUserId === userId;
    return {
      ok: true,
      item: {
        id: row.id.toString(),
        publicId: row.publicId,
        type: isSender ? "transfer_sent" : "transfer_received",
        amountCents: amountCentsNum,
        status: status as TransferHistoryItem["status"],
        counterpartyName: isSender
          ? (row.receiverName ?? "Unknown")
          : (row.senderName ?? "Unknown"),
        note: row.note,
        createdAt: row.createdAt,
      },
    };
  }

  findByUserId(
    userId: bigint
  ): ResultAsync<TransferHistoryItem[], InternalError> {
    const senderUser = alias(users, "sender_user");
    const receiverUser = alias(users, "receiver_user");

    return ResultAsync.fromPromise(
      this.db
        .select({
          id: transfers.id,
          publicId: transfers.publicId,
          senderUserId: transfers.senderUserId,
          amountCents: transfers.netAmountCents,
          status: transactionStatuses.name,
          senderName: senderUser.name,
          receiverName: receiverUser.name,
          note: transfers.note,
          createdAt: transfers.createdAt,
        })
        .from(transfers)
        .innerJoin(
          transactionStatuses,
          eq(transfers.statusId, transactionStatuses.id)
        )
        .leftJoin(senderUser, eq(transfers.senderUserId, senderUser.id))
        .leftJoin(receiverUser, eq(transfers.receiverUserId, receiverUser.id))
        .where(
          or(
            eq(transfers.senderUserId, userId),
            eq(transfers.receiverUserId, userId)
          )
        )
        .orderBy(desc(transfers.createdAt)),
      (e): InternalError =>
        new InternalError("Failed to fetch transfer history", {
          cause: e,
          context: { userId: userId.toString() },
        })
    ).andThen((rows) => {
      const mapped: TransferHistoryItem[] = [];
      for (const row of rows) {
        const result = this.validateAndMapRow(row, userId);
        if (!result.ok) {
          return errAsync(result.error);
        }
        mapped.push(result.item);
      }
      return okAsync(mapped);
    });
  }
}
