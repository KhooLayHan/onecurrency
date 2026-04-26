"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { ArrowDownLeft, ArrowUpRight, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Transaction type from the database schema
export type Transaction = {
  id: string;
  publicId: string;
  type: "add_money" | "cash_out";
  amountCents: number;
  status: "pending" | "processing" | "completed" | "failed" | "refunded";
  createdAt: Date;
  description?: string;
};

// Conversion factor for cents to dollars
const CENTS_TO_DOLLARS = 100;

// Status badge styling based on transaction status
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

// Type labels - using Web2 terminology per design system
const TYPE_LABELS: Record<
  Transaction["type"],
  { label: string; icon: typeof ArrowDownLeft }
> = {
  add_money: { label: "Add Money", icon: ArrowDownLeft },
  cash_out: { label: "Cash Out", icon: ArrowUpRight },
};

export const transactionColumns: ColumnDef<Transaction>[] = [
  {
    accessorKey: "createdAt",
    header: "Date",
    cell: ({ row }) => {
      const date = row.getValue("createdAt") as Date;
      return (
        <div className="text-muted-foreground text-sm">
          {format(date, "MMM d, yyyy")}
        </div>
      );
    },
  },
  {
    accessorKey: "type",
    header: "Description",
    cell: ({ row }) => {
      const type = row.getValue("type") as Transaction["type"];
      const { label, icon: Icon } = TYPE_LABELS[type];
      const isIncoming = type === "add_money";

      return (
        <div className="flex items-center gap-2">
          <div
            className={`flex size-8 items-center justify-center rounded-full ${
              isIncoming
                ? "bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Icon className="size-4" />
          </div>
          <span className="font-medium">{label}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "amountCents",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => {
      const amountCents = row.getValue("amountCents") as number;
      const type = row.original.type;
      const isIncoming = type === "add_money";

      const formatted = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amountCents / CENTS_TO_DOLLARS);

      return (
        <div
          className={`text-right font-medium tabular-nums ${
            isIncoming ? "text-success-600 dark:text-success-400" : "text-destructive"
          }`}
        >
          {isIncoming ? "+" : "-"}
          {formatted}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as Transaction["status"];
      const { className, label } = STATUS_BADGE_VARIANTS[status];

      return <Badge className={className}>{label}</Badge>;
    },
  },
  {
    id: "actions",
    cell: () => (
      <Button className="size-8" size="icon-sm" variant="ghost">
        <MoreHorizontal className="size-4" />
        <span className="sr-only">Open menu</span>
      </Button>
    ),
  },
];
