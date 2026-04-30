import z from "zod";
import { db } from "@/src/db";
import { TransactionAdminService } from "@/src/services/transaction-admin.service";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requirePermission } from "../middleware";

const service = new TransactionAdminService(db);

const ADMIN_TRANSACTION_PAGE_SIZE = 20;

const adminTransactionItemSchema = z.object({
  publicId: z.string(),
  type: z.enum(["add_money", "cash_out", "transfer"]),
  amountCents: z.number(),
  feeCents: z.number(),
  status: z.enum(["pending", "processing", "completed", "failed", "refunded"]),
  createdAt: z.date(),
  completedAt: z.date().nullable(),
  userPublicId: z.string(),
  userName: z.string(),
  userEmail: z.string(),
  counterpartyPublicId: z.string().nullable(),
  counterpartyName: z.string().nullable(),
  blockchainTxHash: z.string().nullable(),
});

function parseDateFilter(value: string | undefined): Date | undefined {
  if (!value) {
    return;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return;
  }
  return d;
}

export const listAdminTransactions = base
  .use(requirePermission("transaction:list"))
  .input(
    z.object({
      page: z.number().int().min(1).default(1),
      type: z.enum(["add_money", "cash_out", "transfer"]).optional(),
      statusId: z.number().int().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      search: z.string().trim().optional(),
    })
  )
  .output(
    z.object({
      items: z.array(adminTransactionItemSchema),
      total: z.number(),
      page: z.number(),
      pageSize: z.number(),
    })
  )
  .handler(async ({ input }) => {
    const result = await service.list({
      page: input.page,
      pageSize: ADMIN_TRANSACTION_PAGE_SIZE,
      type: input.type,
      statusId: input.statusId,
      dateFrom: parseDateFilter(input.dateFrom),
      dateTo: parseDateFilter(input.dateTo),
      search: input.search,
    });

    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }

    return result.value;
  });

export const getAdminTransaction = base
  .use(requirePermission("transaction:read"))
  .input(z.object({ publicId: z.uuid() }))
  .output(adminTransactionItemSchema)
  .handler(async ({ input }) => {
    const result = await service.get(input.publicId);

    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }

    return result.value;
  });
