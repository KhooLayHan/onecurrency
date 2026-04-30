"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Download, Receipt, Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Transaction } from "./transaction-columns";

// Number of skeleton rows to show during loading
const SKELETON_ROW_COUNT = 5;
const CSV_FILENAME_PREFIX = "transactions";
const CSV_FILENAME_DATE_LOCALE = "en-CA"; // YYYY-MM-DD

// CSV column headers
const CSV_HEADERS = [
  "Date",
  "Type",
  "Counterparty",
  "Amount (USD)",
  "Status",
  "Receipt Reference",
] as const;

// Human-readable type labels for CSV export
const CSV_TYPE_LABELS: Record<Transaction["type"], string> = {
  add_money: "Add Money",
  cash_out: "Cash Out",
  transfer_sent: "Sent",
  transfer_received: "Received",
};

const CSV_FORMULA_PREFIX_RE = /^[=+\-@]/;
function escapeCsvCell(value: string) {
  const sanitized = CSV_FORMULA_PREFIX_RE.test(value) ? `'${value}` : value;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

// Conversion factor for cents to dollars
const CENTS_TO_DOLLARS = 100;

function exportToCsv(rows: Transaction[]) {
  const csvContent = [
    CSV_HEADERS.join(","),
    ...rows.map((t) => {
      const amount = (t.amountCents / CENTS_TO_DOLLARS).toFixed(2);
      const isIncoming =
        t.type === "add_money" || t.type === "transfer_received";
      const signedAmount = `${isIncoming ? "+" : "-"}${amount}`;

      return [
        new Date(t.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        CSV_TYPE_LABELS[t.type],
        t.counterpartyName ?? "",
        signedAmount,
        t.status.charAt(0).toUpperCase() + t.status.slice(1),
        t.publicId,
      ]
        .map((cell) => escapeCsvCell(String(cell)))
        .join(",");
    }),
  ].join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;

  const localDate = new Intl.DateTimeFormat(CSV_FILENAME_DATE_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  link.download = `${CSV_FILENAME_PREFIX}-${localDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

type TransactionDataTableProps<TValue> = {
  columns: ColumnDef<Transaction, TValue>[];
  data: Transaction[];
  isLoading?: boolean;
};

export function TransactionDataTable<TValue>({
  columns,
  data,
  isLoading = false,
}: TransactionDataTableProps<TValue>) {
  const [globalFilter, setGlobalFilter] = useState("");

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const t = row.original as Transaction;
      const q = filterValue.toLowerCase();
      return (
        CSV_TYPE_LABELS[t.type].toLowerCase().includes(q) ||
        (t.counterpartyName?.toLowerCase().includes(q) ?? false) ||
        t.status.toLowerCase().includes(q) ||
        t.publicId.toLowerCase().includes(q)
      );
    },
    state: { globalFilter },
    onGlobalFilterChange: setGlobalFilter,
  });

  // Loading state with skeleton rows
  if (isLoading) {
    return (
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((_column, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton header cells never reorder
                <TableHead key={index}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: SKELETON_ROW_COUNT }).map((_, rowIndex) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton rows never reorder
              <TableRow key={rowIndex}>
                {columns.map((__, colIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Static skeleton cells never reorder
                  <TableCell key={colIndex}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 p-12 text-center">
        <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-secondary">
          <Receipt className="size-6 text-muted-foreground" />
        </div>
        <h3 className="font-medium text-base">No transactions yet</h3>
        <p className="mt-1 max-w-sm text-muted-foreground text-sm">
          When you add money or make transfers, your transaction history will
          appear here.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar: search + export */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            aria-label="Search transactions"
            className="pl-9"
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search transactions..."
            value={globalFilter}
          />
        </div>
        <Button
          onClick={() =>
            exportToCsv(table.getFilteredRowModel().rows.map((r) => r.original))
          }
          size="sm"
          variant="outline"
        >
          <Download className="mr-2 size-4" />
          Export CSV
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell
                  className="py-8 text-center text-muted-foreground text-sm"
                  colSpan={columns.length}
                >
                  No transactions match your search.
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  data-state={row.getIsSelected() && "selected"}
                  key={row.id}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between py-4">
        <div className="text-muted-foreground text-sm">
          {table.getFilteredRowModel().rows.length} transaction(s)
        </div>
        <div className="flex items-center gap-2">
          <Button
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
            size="sm"
            variant="outline"
          >
            Previous
          </Button>
          <Button
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
            size="sm"
            variant="outline"
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
