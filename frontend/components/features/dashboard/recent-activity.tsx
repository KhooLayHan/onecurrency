"use client";

import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Inbox,
  Receipt,
  Send,
} from "lucide-react";
import { useMemo } from "react";
import type { Transaction } from "@/components/features/history/transaction-columns";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { orpcClient } from "@/lib/api";

const RECENT_ACTIVITY_LIMIT = 5;
const CENTS_TO_DOLLARS = 100;
const SKELETON_ROW_COUNT = 3;

const DEPOSIT_HISTORY_QUERY_KEY = "deposit-history";
const WITHDRAWAL_HISTORY_QUERY_KEY = "withdrawal-history";
const TRANSFER_HISTORY_QUERY_KEY = "transfer-history";

const TYPE_CONFIG: Record<
  Transaction["type"],
  { label: string; icon: typeof ArrowDownLeft; incoming: boolean }
> = {
  add_money: { label: "Add Money", icon: ArrowDownLeft, incoming: true },
  cash_out: { label: "Cash Out", icon: ArrowUpRight, incoming: false },
  transfer_sent: { label: "Sent", icon: Send, incoming: false },
  transfer_received: { label: "Received", icon: Inbox, incoming: true },
};

const STATUS_BADGE_VARIANTS: Record<
  Transaction["status"],
  { className: string; label: string }
> = {
  completed: {
    className:
      "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400",
    label: "Completed",
  },
  pending: {
    className:
      "bg-highlight-100 text-highlight-700 dark:bg-highlight-900/30 dark:text-highlight-400",
    label: "Pending",
  },
  processing: {
    className:
      "bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400",
    label: "Processing",
  },
  failed: {
    className: "bg-destructive/10 text-destructive",
    label: "Failed",
  },
  refunded: {
    className: "bg-muted text-muted-foreground",
    label: "Refunded",
  },
};

function ActivityRow({ transaction }: { transaction: Transaction }) {
  const { label, icon: Icon, incoming } = TYPE_CONFIG[transaction.type];
  const { className: statusClass, label: statusLabel } =
    STATUS_BADGE_VARIANTS[transaction.status];

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(transaction.amountCents / CENTS_TO_DOLLARS);

  const relativeDate = formatDistanceToNow(new Date(transaction.createdAt), {
    addSuffix: true,
  });

  return (
    <div className="flex items-center gap-3 py-3">
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
          incoming
            ? "bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400"
            : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{label}</p>
        {transaction.counterpartyName ? (
          <p className="truncate text-muted-foreground text-xs">
            {transaction.counterpartyName}
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">{relativeDate}</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className={`font-semibold text-sm tabular-nums ${
            incoming
              ? "text-success-600 dark:text-success-400"
              : "text-destructive"
          }`}
        >
          {incoming ? "+" : "-"}
          {formattedAmount}
        </span>
        <Badge className={`text-xs ${statusClass}`}>{statusLabel}</Badge>
      </div>
    </div>
  );
}

export function RecentActivityList() {
  const { data: deposits = [], isLoading: isLoadingDeposits } = useQuery({
    queryKey: [DEPOSIT_HISTORY_QUERY_KEY],
    queryFn: () => orpcClient.deposits.getHistory({}),
  });

  const { data: withdrawals = [], isLoading: isLoadingWithdrawals } = useQuery({
    queryKey: [WITHDRAWAL_HISTORY_QUERY_KEY],
    queryFn: () => orpcClient.withdrawals.getHistory({}),
  });

  const { data: transfersRaw = [], isLoading: isLoadingTransfers } = useQuery({
    queryKey: [TRANSFER_HISTORY_QUERY_KEY],
    queryFn: () => orpcClient.transfers.getHistory({}),
  });

  const isLoading =
    isLoadingDeposits || isLoadingWithdrawals || isLoadingTransfers;

  const recentTransactions: Transaction[] = useMemo(() => {
    const transfers: Transaction[] = transfersRaw.map((t) => ({
      id: t.id,
      publicId: t.publicId,
      type: t.type,
      amountCents: t.amountCents,
      status: t.status,
      createdAt: new Date(t.createdAt),
      counterpartyName: t.counterpartyName,
      note: t.note,
    }));

    return [...deposits, ...withdrawals, ...transfers]
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .slice(0, RECENT_ACTIVITY_LIMIT);
  }, [deposits, withdrawals, transfersRaw]);

  if (isLoading) {
    return (
      <div className="divide-y rounded-xl border bg-card">
        {Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton rows never reorder
          <div className="flex items-center gap-3 px-4 py-3" key={i}>
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-14 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (recentTransactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 p-12 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-secondary">
          <Receipt className="size-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-base">No activity yet</h3>
        <p className="mt-1 max-w-sm text-muted-foreground text-sm">
          When you add money to your account, your transactions will appear
          here.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y rounded-xl border bg-card">
      {recentTransactions.map((transaction) => (
        <div className="px-4" key={transaction.id}>
          <ActivityRow transaction={transaction} />
        </div>
      ))}
    </div>
  );
}
