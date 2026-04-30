import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { InternalError } from "@/common/errors/infrastructure";
import type { Database } from "../db";
import { blockchainTransactions } from "../db/schema/blockchain-transactions";
import { deposits } from "../db/schema/deposits";
import { transactionStatuses } from "../db/schema/transaction-statuses";
import { transfers } from "../db/schema/transfers";
import { users } from "../db/schema/users";
import { withdrawals } from "../db/schema/withdrawals";

export type AdminTransactionItem = {
  publicId: string;
  type: "add_money" | "cash_out" | "transfer";
  amountCents: number;
  feeCents: number;
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  createdAt: Date;
  completedAt: Date | null;
  userPublicId: string;
  userName: string;
  userEmail: string;
  counterpartyPublicId: string | null;
  counterpartyName: string | null;
  blockchainTxHash: string | null;
};

type ListFilters = {
  type?: "add_money" | "cash_out" | "transfer";
  statusId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page: number;
  pageSize: number;
};

type ListResult = {
  items: AdminTransactionItem[];
  total: number;
  page: number;
  pageSize: number;
};

// Alias type is the same shape as the original table for our purposes
type UserAlias = ReturnType<typeof alias<typeof users, string>>;

const VALID_STATUSES = new Set([
  "pending",
  "processing",
  "completed",
  "failed",
  "refunded",
]);

const ADMIN_TRANSACTION_PAGE_SIZE = 20;

function validateStatus(raw: string): AdminTransactionItem["status"] | null {
  const s = raw.toLowerCase();
  if (VALID_STATUSES.has(s)) {
    return s as AdminTransactionItem["status"];
  }
  return null;
}

function toCents(value: bigint | null): number {
  return Number(value ?? 0n);
}

/** Compact type-safe filter to remove nulls without confusing the predicate */
function compact<T>(arr: (T | null)[]): T[] {
  return arr.filter((x): x is T => x !== null);
}

function buildWhere(conditions: SQL[]): SQL | undefined {
  return conditions.length > 0 ? and(...conditions) : undefined;
}

export class TransactionAdminService {
  private readonly db: Database;

  constructor(database: Database) {
    this.db = database;
  }

  list(filters: ListFilters): ResultAsync<ListResult, InternalError> {
    const pageSize = filters.pageSize || ADMIN_TRANSACTION_PAGE_SIZE;

    if (filters.type) {
      return this.listSingleType({ ...filters, pageSize, type: filters.type });
    }

    return this.listAllTypes({ ...filters, pageSize });
  }

  get(publicId: string): ResultAsync<AdminTransactionItem, InternalError> {
    return ResultAsync.fromPromise(
      Promise.all([
        this.findDeposit(publicId),
        this.findWithdrawal(publicId),
        this.findTransfer(publicId),
      ]),
      (e): InternalError =>
        new InternalError("Failed to fetch transaction details", {
          cause: e,
          context: { publicId },
        })
    ).andThen(([deposit, withdrawal, transfer]) => {
      const found = deposit ?? withdrawal ?? transfer;
      if (!found) {
        return errAsync(
          new InternalError("Transaction not found", { context: { publicId } })
        );
      }
      return okAsync(found);
    });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private listSingleType(
    filters: ListFilters & { type: "add_money" | "cash_out" | "transfer" }
  ): ResultAsync<ListResult, InternalError> {
    const { pageSize, type } = filters;
    const offset = (filters.page - 1) * pageSize;

    if (type === "add_money") {
      return this.queryDeposits(filters, pageSize, offset);
    }
    if (type === "cash_out") {
      return this.queryWithdrawals(filters, pageSize, offset);
    }
    return this.queryTransfers(filters, pageSize, offset);
  }

  private listAllTypes(
    filters: ListFilters
  ): ResultAsync<ListResult, InternalError> {
    const pageSize = filters.pageSize;

    return ResultAsync.fromPromise(
      Promise.all([
        this.countDeposits(filters),
        this.countWithdrawals(filters),
        this.countTransfers(filters),
        this.fetchDeposits(filters),
        this.fetchWithdrawals(filters),
        this.fetchTransfers(filters),
      ]),
      (e): InternalError =>
        new InternalError("Failed to fetch unified transaction list", {
          cause: e,
        })
    ).map(
      ([
        depositCount,
        withdrawalCount,
        transferCount,
        depositRows,
        withdrawalRows,
        transferRows,
      ]) => {
        const total = depositCount + withdrawalCount + transferCount;
        const all = [...depositRows, ...withdrawalRows, ...transferRows].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
        );
        const start = (filters.page - 1) * pageSize;
        const items = all.slice(start, start + pageSize);
        return { items, total, page: filters.page, pageSize };
      }
    );
  }

  // ─── Deposit queries ───────────────────────────────────────────────────────

  private async countDeposits(filters: ListFilters): Promise<number> {
    const where = this.buildDepositWhere(filters);
    const query = this.db
      .select({ count: count() })
      .from(deposits)
      .innerJoin(users, eq(deposits.userId, users.id));
    const [result] = where ? await query.where(where) : await query;
    return result?.count ?? 0;
  }

  private async fetchDeposits(
    filters: ListFilters
  ): Promise<AdminTransactionItem[]> {
    const where = this.buildDepositWhere(filters);
    const base = this.db
      .select({
        publicId: deposits.publicId,
        amountCents: deposits.netAmountCents,
        feeCents: deposits.feeCents,
        status: transactionStatuses.name,
        createdAt: deposits.createdAt,
        completedAt: deposits.completedAt,
        userPublicId: users.publicId,
        userName: users.name,
        userEmail: users.email,
        blockchainTxHash: blockchainTransactions.txHash,
      })
      .from(deposits)
      .innerJoin(users, eq(deposits.userId, users.id))
      .innerJoin(
        transactionStatuses,
        eq(deposits.statusId, transactionStatuses.id)
      )
      .leftJoin(
        blockchainTransactions,
        eq(deposits.blockchainTxId, blockchainTransactions.id)
      )
      .orderBy(desc(deposits.createdAt));

    const rows = where ? await base.where(where) : await base;
    return compact(
      rows.map((row) => {
        const status = validateStatus(row.status);
        if (!status) {
          return null;
        }
        return {
          publicId: row.publicId,
          type: "add_money" as const,
          amountCents: toCents(row.amountCents),
          feeCents: toCents(row.feeCents),
          status,
          createdAt: row.createdAt,
          completedAt: row.completedAt,
          userPublicId: row.userPublicId,
          userName: row.userName,
          userEmail: row.userEmail,
          counterpartyPublicId: null,
          counterpartyName: null,
          blockchainTxHash: row.blockchainTxHash,
        } satisfies AdminTransactionItem;
      })
    );
  }

  private queryDeposits(
    filters: ListFilters,
    limit: number,
    offset: number
  ): ResultAsync<ListResult, InternalError> {
    const where = this.buildDepositWhere(filters);
    const base = this.db
      .select({
        publicId: deposits.publicId,
        amountCents: deposits.netAmountCents,
        feeCents: deposits.feeCents,
        status: transactionStatuses.name,
        createdAt: deposits.createdAt,
        completedAt: deposits.completedAt,
        userPublicId: users.publicId,
        userName: users.name,
        userEmail: users.email,
        blockchainTxHash: blockchainTransactions.txHash,
      })
      .from(deposits)
      .innerJoin(users, eq(deposits.userId, users.id))
      .innerJoin(
        transactionStatuses,
        eq(deposits.statusId, transactionStatuses.id)
      )
      .leftJoin(
        blockchainTransactions,
        eq(deposits.blockchainTxId, blockchainTransactions.id)
      )
      .orderBy(desc(deposits.createdAt))
      .limit(limit)
      .offset(offset);

    return ResultAsync.fromPromise(
      Promise.all([
        this.countDeposits(filters),
        where ? base.where(where) : base,
      ]),
      (e): InternalError =>
        new InternalError("Failed to fetch deposit list", { cause: e })
    ).map(([total, rows]) => ({
      items: compact(
        rows.map((row) => {
          const status = validateStatus(row.status);
          if (!status) {
            return null;
          }
          return {
            publicId: row.publicId,
            type: "add_money" as const,
            amountCents: toCents(row.amountCents),
            feeCents: toCents(row.feeCents),
            status,
            createdAt: row.createdAt,
            completedAt: row.completedAt,
            userPublicId: row.userPublicId,
            userName: row.userName,
            userEmail: row.userEmail,
            counterpartyPublicId: null,
            counterpartyName: null,
            blockchainTxHash: row.blockchainTxHash,
          } satisfies AdminTransactionItem;
        })
      ),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    }));
  }

  private buildDepositWhere(filters: ListFilters): SQL | undefined {
    const conditions: SQL[] = [];
    if (filters.statusId) {
      conditions.push(eq(deposits.statusId, filters.statusId));
    }
    if (filters.dateFrom) {
      conditions.push(gte(deposits.createdAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(deposits.createdAt, filters.dateTo));
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(ilike(users.name, term), ilike(users.email, term)) as SQL
      );
    }
    return buildWhere(conditions);
  }

  // ─── Withdrawal queries ────────────────────────────────────────────────────

  private async countWithdrawals(filters: ListFilters): Promise<number> {
    const where = this.buildWithdrawalWhere(filters);
    const query = this.db
      .select({ count: count() })
      .from(withdrawals)
      .innerJoin(users, eq(withdrawals.userId, users.id));
    const [result] = where ? await query.where(where) : await query;
    return result?.count ?? 0;
  }

  private async fetchWithdrawals(
    filters: ListFilters
  ): Promise<AdminTransactionItem[]> {
    const where = this.buildWithdrawalWhere(filters);
    const base = this.db
      .select({
        publicId: withdrawals.publicId,
        amountCents: withdrawals.netAmountCents,
        feeCents: withdrawals.feeCents,
        status: transactionStatuses.name,
        createdAt: withdrawals.createdAt,
        completedAt: withdrawals.completedAt,
        userPublicId: users.publicId,
        userName: users.name,
        userEmail: users.email,
        blockchainTxHash: blockchainTransactions.txHash,
      })
      .from(withdrawals)
      .innerJoin(users, eq(withdrawals.userId, users.id))
      .innerJoin(
        transactionStatuses,
        eq(withdrawals.statusId, transactionStatuses.id)
      )
      .leftJoin(
        blockchainTransactions,
        eq(withdrawals.blockchainTxId, blockchainTransactions.id)
      )
      .orderBy(desc(withdrawals.createdAt));

    const rows = where ? await base.where(where) : await base;
    return compact(
      rows.map((row) => {
        const status = validateStatus(row.status);
        if (!status) {
          return null;
        }
        return {
          publicId: row.publicId,
          type: "cash_out" as const,
          amountCents: toCents(row.amountCents),
          feeCents: toCents(row.feeCents),
          status,
          createdAt: row.createdAt,
          completedAt: row.completedAt,
          userPublicId: row.userPublicId,
          userName: row.userName,
          userEmail: row.userEmail,
          counterpartyPublicId: null,
          counterpartyName: null,
          blockchainTxHash: row.blockchainTxHash,
        } satisfies AdminTransactionItem;
      })
    );
  }

  private queryWithdrawals(
    filters: ListFilters,
    limit: number,
    offset: number
  ): ResultAsync<ListResult, InternalError> {
    const where = this.buildWithdrawalWhere(filters);
    const base = this.db
      .select({
        publicId: withdrawals.publicId,
        amountCents: withdrawals.netAmountCents,
        feeCents: withdrawals.feeCents,
        status: transactionStatuses.name,
        createdAt: withdrawals.createdAt,
        completedAt: withdrawals.completedAt,
        userPublicId: users.publicId,
        userName: users.name,
        userEmail: users.email,
        blockchainTxHash: blockchainTransactions.txHash,
      })
      .from(withdrawals)
      .innerJoin(users, eq(withdrawals.userId, users.id))
      .innerJoin(
        transactionStatuses,
        eq(withdrawals.statusId, transactionStatuses.id)
      )
      .leftJoin(
        blockchainTransactions,
        eq(withdrawals.blockchainTxId, blockchainTransactions.id)
      )
      .orderBy(desc(withdrawals.createdAt))
      .limit(limit)
      .offset(offset);

    return ResultAsync.fromPromise(
      Promise.all([
        this.countWithdrawals(filters),
        where ? base.where(where) : base,
      ]),
      (e): InternalError =>
        new InternalError("Failed to fetch withdrawal list", { cause: e })
    ).map(([total, rows]) => ({
      items: compact(
        rows.map((row) => {
          const status = validateStatus(row.status);
          if (!status) {
            return null;
          }
          return {
            publicId: row.publicId,
            type: "cash_out" as const,
            amountCents: toCents(row.amountCents),
            feeCents: toCents(row.feeCents),
            status,
            createdAt: row.createdAt,
            completedAt: row.completedAt,
            userPublicId: row.userPublicId,
            userName: row.userName,
            userEmail: row.userEmail,
            counterpartyPublicId: null,
            counterpartyName: null,
            blockchainTxHash: row.blockchainTxHash,
          } satisfies AdminTransactionItem;
        })
      ),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    }));
  }

  private buildWithdrawalWhere(filters: ListFilters): SQL | undefined {
    const conditions: SQL[] = [];
    if (filters.statusId) {
      conditions.push(eq(withdrawals.statusId, filters.statusId));
    }
    if (filters.dateFrom) {
      conditions.push(gte(withdrawals.createdAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(withdrawals.createdAt, filters.dateTo));
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(ilike(users.name, term), ilike(users.email, term)) as SQL
      );
    }
    return buildWhere(conditions);
  }

  // ─── Transfer queries ──────────────────────────────────────────────────────

  private async fetchTransfers(
    filters: ListFilters
  ): Promise<AdminTransactionItem[]> {
    const senderUser = alias(users, "sender_user");
    const receiverUser = alias(users, "receiver_user");
    const where = this.buildTransferWhere(filters, senderUser, receiverUser);

    const base = this.db
      .select({
        publicId: transfers.publicId,
        amountCents: transfers.netAmountCents,
        feeCents: transfers.feeCents,
        status: transactionStatuses.name,
        createdAt: transfers.createdAt,
        completedAt: transfers.completedAt,
        userPublicId: senderUser.publicId,
        userName: senderUser.name,
        userEmail: senderUser.email,
        counterpartyPublicId: receiverUser.publicId,
        counterpartyName: receiverUser.name,
        blockchainTxHash: blockchainTransactions.txHash,
      })
      .from(transfers)
      .innerJoin(senderUser, eq(transfers.senderUserId, senderUser.id))
      .leftJoin(receiverUser, eq(transfers.receiverUserId, receiverUser.id))
      .innerJoin(
        transactionStatuses,
        eq(transfers.statusId, transactionStatuses.id)
      )
      .leftJoin(
        blockchainTransactions,
        eq(transfers.blockchainTxId, blockchainTransactions.id)
      )
      .orderBy(desc(transfers.createdAt));

    const rows = where ? await base.where(where) : await base;
    return compact(
      rows.map((row) => {
        const status = validateStatus(row.status);
        if (!status) {
          return null;
        }
        return {
          publicId: row.publicId,
          type: "transfer" as const,
          amountCents: toCents(row.amountCents),
          feeCents: toCents(row.feeCents),
          status,
          createdAt: row.createdAt,
          completedAt: row.completedAt,
          userPublicId: row.userPublicId,
          userName: row.userName,
          userEmail: row.userEmail,
          counterpartyPublicId: row.counterpartyPublicId,
          counterpartyName: row.counterpartyName,
          blockchainTxHash: row.blockchainTxHash,
        } satisfies AdminTransactionItem;
      })
    );
  }

  private async countTransfers(filters: ListFilters): Promise<number> {
    const senderUser = alias(users, "sender_user");
    const receiverUser = alias(users, "receiver_user");
    const where = this.buildTransferWhere(filters, senderUser, receiverUser);
    const query = this.db
      .select({ count: count() })
      .from(transfers)
      .innerJoin(senderUser, eq(transfers.senderUserId, senderUser.id))
      .leftJoin(receiverUser, eq(transfers.receiverUserId, receiverUser.id));
    const [result] = where ? await query.where(where) : await query;
    return result?.count ?? 0;
  }

  private queryTransfers(
    filters: ListFilters,
    limit: number,
    offset: number
  ): ResultAsync<ListResult, InternalError> {
    const senderUser = alias(users, "sender_user");
    const receiverUser = alias(users, "receiver_user");
    const where = this.buildTransferWhere(filters, senderUser, receiverUser);

    const base = this.db
      .select({
        publicId: transfers.publicId,
        amountCents: transfers.netAmountCents,
        feeCents: transfers.feeCents,
        status: transactionStatuses.name,
        createdAt: transfers.createdAt,
        completedAt: transfers.completedAt,
        userPublicId: senderUser.publicId,
        userName: senderUser.name,
        userEmail: senderUser.email,
        counterpartyPublicId: receiverUser.publicId,
        counterpartyName: receiverUser.name,
        blockchainTxHash: blockchainTransactions.txHash,
      })
      .from(transfers)
      .innerJoin(senderUser, eq(transfers.senderUserId, senderUser.id))
      .leftJoin(receiverUser, eq(transfers.receiverUserId, receiverUser.id))
      .innerJoin(
        transactionStatuses,
        eq(transfers.statusId, transactionStatuses.id)
      )
      .leftJoin(
        blockchainTransactions,
        eq(transfers.blockchainTxId, blockchainTransactions.id)
      )
      .orderBy(desc(transfers.createdAt))
      .limit(limit)
      .offset(offset);

    return ResultAsync.fromPromise(
      Promise.all([
        this.countTransfers(filters),
        where ? base.where(where) : base,
      ]),
      (e): InternalError =>
        new InternalError("Failed to fetch transfer list", { cause: e })
    ).map(([total, rows]) => ({
      items: compact(
        rows.map((row) => {
          const status = validateStatus(row.status);
          if (!status) {
            return null;
          }
          return {
            publicId: row.publicId,
            type: "transfer" as const,
            amountCents: toCents(row.amountCents),
            feeCents: toCents(row.feeCents),
            status,
            createdAt: row.createdAt,
            completedAt: row.completedAt,
            userPublicId: row.userPublicId,
            userName: row.userName,
            userEmail: row.userEmail,
            counterpartyPublicId: row.counterpartyPublicId,
            counterpartyName: row.counterpartyName,
            blockchainTxHash: row.blockchainTxHash,
          } satisfies AdminTransactionItem;
        })
      ),
      total,
      page: filters.page,
      pageSize: filters.pageSize,
    }));
  }

  private buildTransferWhere(
    filters: ListFilters,
    senderUser: UserAlias,
    receiverUser: UserAlias
  ): SQL | undefined {
    const conditions: SQL[] = [];
    if (filters.statusId) {
      conditions.push(eq(transfers.statusId, filters.statusId));
    }
    if (filters.dateFrom) {
      conditions.push(gte(transfers.createdAt, filters.dateFrom));
    }
    if (filters.dateTo) {
      conditions.push(lte(transfers.createdAt, filters.dateTo));
    }
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          ilike(senderUser.name, term),
          ilike(senderUser.email, term),
          ilike(receiverUser.name, term),
          ilike(receiverUser.email, term)
        ) as SQL
      );
    }
    return buildWhere(conditions);
  }

  // ─── Single-record lookups ─────────────────────────────────────────────────

  private async findDeposit(
    publicId: string
  ): Promise<AdminTransactionItem | null> {
    const [row] = await this.db
      .select({
        publicId: deposits.publicId,
        amountCents: deposits.netAmountCents,
        feeCents: deposits.feeCents,
        status: transactionStatuses.name,
        createdAt: deposits.createdAt,
        completedAt: deposits.completedAt,
        userPublicId: users.publicId,
        userName: users.name,
        userEmail: users.email,
        blockchainTxHash: blockchainTransactions.txHash,
      })
      .from(deposits)
      .innerJoin(users, eq(deposits.userId, users.id))
      .innerJoin(
        transactionStatuses,
        eq(deposits.statusId, transactionStatuses.id)
      )
      .leftJoin(
        blockchainTransactions,
        eq(deposits.blockchainTxId, blockchainTransactions.id)
      )
      .where(eq(deposits.publicId, publicId));

    if (!row) {
      return null;
    }
    const status = validateStatus(row.status);
    if (!status) {
      return null;
    }
    return {
      publicId: row.publicId,
      type: "add_money",
      amountCents: toCents(row.amountCents),
      feeCents: toCents(row.feeCents),
      status,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      userPublicId: row.userPublicId,
      userName: row.userName,
      userEmail: row.userEmail,
      counterpartyPublicId: null,
      counterpartyName: null,
      blockchainTxHash: row.blockchainTxHash,
    };
  }

  private async findWithdrawal(
    publicId: string
  ): Promise<AdminTransactionItem | null> {
    const [row] = await this.db
      .select({
        publicId: withdrawals.publicId,
        amountCents: withdrawals.netAmountCents,
        feeCents: withdrawals.feeCents,
        status: transactionStatuses.name,
        createdAt: withdrawals.createdAt,
        completedAt: withdrawals.completedAt,
        userPublicId: users.publicId,
        userName: users.name,
        userEmail: users.email,
        blockchainTxHash: blockchainTransactions.txHash,
      })
      .from(withdrawals)
      .innerJoin(users, eq(withdrawals.userId, users.id))
      .innerJoin(
        transactionStatuses,
        eq(withdrawals.statusId, transactionStatuses.id)
      )
      .leftJoin(
        blockchainTransactions,
        eq(withdrawals.blockchainTxId, blockchainTransactions.id)
      )
      .where(eq(withdrawals.publicId, publicId));

    if (!row) {
      return null;
    }
    const status = validateStatus(row.status);
    if (!status) {
      return null;
    }
    return {
      publicId: row.publicId,
      type: "cash_out",
      amountCents: toCents(row.amountCents),
      feeCents: toCents(row.feeCents),
      status,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      userPublicId: row.userPublicId,
      userName: row.userName,
      userEmail: row.userEmail,
      counterpartyPublicId: null,
      counterpartyName: null,
      blockchainTxHash: row.blockchainTxHash,
    };
  }

  private async findTransfer(
    publicId: string
  ): Promise<AdminTransactionItem | null> {
    const senderUser = alias(users, "sender_user");
    const receiverUser = alias(users, "receiver_user");

    const [row] = await this.db
      .select({
        publicId: transfers.publicId,
        amountCents: transfers.netAmountCents,
        feeCents: transfers.feeCents,
        status: transactionStatuses.name,
        createdAt: transfers.createdAt,
        completedAt: transfers.completedAt,
        userPublicId: senderUser.publicId,
        userName: senderUser.name,
        userEmail: senderUser.email,
        counterpartyPublicId: receiverUser.publicId,
        counterpartyName: receiverUser.name,
        blockchainTxHash: blockchainTransactions.txHash,
      })
      .from(transfers)
      .innerJoin(senderUser, eq(transfers.senderUserId, senderUser.id))
      .leftJoin(receiverUser, eq(transfers.receiverUserId, receiverUser.id))
      .innerJoin(
        transactionStatuses,
        eq(transfers.statusId, transactionStatuses.id)
      )
      .leftJoin(
        blockchainTransactions,
        eq(transfers.blockchainTxId, blockchainTransactions.id)
      )
      .where(eq(transfers.publicId, publicId));

    if (!row) {
      return null;
    }
    const status = validateStatus(row.status);
    if (!status) {
      return null;
    }
    return {
      publicId: row.publicId,
      type: "transfer",
      amountCents: toCents(row.amountCents),
      feeCents: toCents(row.feeCents),
      status,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
      userPublicId: row.userPublicId,
      userName: row.userName,
      userEmail: row.userEmail,
      counterpartyPublicId: row.counterpartyPublicId,
      counterpartyName: row.counterpartyName,
      blockchainTxHash: row.blockchainTxHash,
    };
  }
}
