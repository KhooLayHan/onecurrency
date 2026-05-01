"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { orpcClient } from "@/lib/api";

const HTTP_STATUS_NOT_FOUND = 404;
const CENTS_TO_DOLLARS = 100;
const PUBLIC_ID_DISPLAY_LENGTH = 8;

const TX_TYPE_LABELS: Record<string, string> = {
  add_money: "Add Money",
  cash_out: "Cash Out",
  transfer: "Transfer",
};

const TX_STATUS_VARIANTS: Record<
  string,
  "neutral" | "warning" | "primary" | "success" | "error"
> = {
  pending: "warning",
  processing: "primary",
  completed: "success",
  failed: "error",
  refunded: "neutral",
};

type DetailRow = {
  label: string;
  value: React.ReactNode;
};

function InfoRow({ label, value }: DetailRow) {
  return (
    <div className="flex items-start justify-between gap-4 border-b py-2.5 last:border-b-0">
      <span className="shrink-0 text-muted-foreground text-sm">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

type TransactionDetail = Awaited<
  ReturnType<typeof orpcClient.admin.transactions.get>
>;

function TransactionDetailCards({ tx }: { tx: TransactionDetail }) {
  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Transaction details card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transaction Details</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Type" value={TX_TYPE_LABELS[tx.type] ?? tx.type} />
            <InfoRow
              label="Amount"
              value={
                <span className="tabular-nums">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(tx.amountCents / CENTS_TO_DOLLARS)}
                </span>
              }
            />
            <InfoRow
              label="Processing Fee"
              value={
                <span className="tabular-nums">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                  }).format(tx.feeCents / CENTS_TO_DOLLARS)}
                </span>
              }
            />
            <InfoRow
              label="Status"
              value={
                <Badge variant={TX_STATUS_VARIANTS[tx.status] ?? "neutral"}>
                  {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                </Badge>
              }
            />
            <InfoRow
              label="Created"
              value={new Date(tx.createdAt).toLocaleString()}
            />
            <InfoRow
              label="Completed"
              value={
                tx.completedAt ? new Date(tx.completedAt).toLocaleString() : "—"
              }
            />
          </CardContent>
        </Card>

        {/* Parties card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parties</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow
              label="User"
              value={
                <Link
                  className="font-medium hover:underline"
                  href={`/admin/users/${tx.userPublicId}`}
                >
                  {tx.userName}
                </Link>
              }
            />
            <InfoRow
              label="Email"
              value={
                <span className="text-muted-foreground">{tx.userEmail}</span>
              }
            />
            {tx.counterpartyName && (
              <InfoRow
                label="Counterparty"
                value={
                  tx.counterpartyPublicId ? (
                    <Link
                      className="font-medium hover:underline"
                      href={`/admin/users/${tx.counterpartyPublicId}`}
                    >
                      {tx.counterpartyName}
                    </Link>
                  ) : (
                    tx.counterpartyName
                  )
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* References card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">References</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow
            label="Receipt Reference"
            value={
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                {tx.publicId}
              </code>
            }
          />
          <InfoRow
            label="Processing Reference"
            value={
              tx.blockchainTxHash ? (
                <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                  {tx.blockchainTxHash}
                </code>
              ) : (
                <span className="text-muted-foreground">—</span>
              )
            }
          />
        </CardContent>
      </Card>
    </>
  );
}

export default function AdminTransactionDetailPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: tx,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["admin-transaction", id],
    queryFn: () => orpcClient.admin.transactions.get({ publicId: id }),
  });

  // 404 state
  if (
    isError &&
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status: number }).status === HTTP_STATUS_NOT_FOUND
  ) {
    return (
      <div className="space-y-4">
        <Link
          className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
          href="/admin/transactions"
        >
          <ArrowLeft className="size-4" />
          Transactions
        </Link>
        <div className="py-16 text-center text-muted-foreground">
          Transaction not found.
        </div>
      </div>
    );
  }

  // Generic error state
  if (isError && !isLoading) {
    return (
      <div className="space-y-4">
        <Link
          className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
          href="/admin/transactions"
        >
          <ArrowLeft className="size-4" />
          Transactions
        </Link>
        <div className="py-8 text-center">
          <p className="text-muted-foreground text-sm">
            Failed to load transaction:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
          <Button
            className="mt-2"
            onClick={() => refetch()}
            size="sm"
            variant="outline"
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
          href="/admin/transactions"
        >
          <ArrowLeft className="size-4" />
          Transactions
        </Link>
        {isLoading ? (
          <Skeleton className="h-7 w-56" />
        ) : (
          <div className="flex items-center gap-2.5">
            <h1 className="font-bold text-xl tracking-tight">
              Transaction{" "}
              <span className="font-mono text-base">
                {tx?.publicId.slice(0, PUBLIC_ID_DISPLAY_LENGTH)}…
              </span>
            </h1>
            {tx && (
              <Badge variant={TX_STATUS_VARIANTS[tx.status] ?? "neutral"}>
                {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
              </Badge>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="col-span-full h-32" />
        </div>
      ) : (
        tx && <TransactionDetailCards tx={tx} />
      )}
    </div>
  );
}
