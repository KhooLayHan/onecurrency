"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpcClient } from "@/lib/api";

const ALL_VALUE = "all";
const SKELETON_ROW_COUNT = 5;
const SKELETON_COL_COUNT = 7;
const CENTS_TO_DOLLARS = 100;
const CSV_FILENAME_DATE_LOCALE = "en-CA"; // YYYY-MM-DD format

type TxType = "add_money" | "cash_out" | "transfer";

const TAB_TO_TYPE: Record<string, TxType | undefined> = {
  all: undefined,
  add_money: "add_money",
  cash_out: "cash_out",
  transfer: "transfer",
};

const TX_TYPE_LABELS: Record<TxType, string> = {
  add_money: "Add Money",
  cash_out: "Cash Out",
  transfer: "Transfer",
};

const STATUS_OPTIONS = [
  { value: "1", label: "Pending" },
  { value: "2", label: "Processing" },
  { value: "3", label: "Completed" },
  { value: "4", label: "Failed" },
  { value: "5", label: "Refunded" },
];

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

// CSV helpers
const CSV_HEADERS = [
  "Date",
  "User",
  "Email",
  "Type",
  "Amount (USD)",
  "Fee (USD)",
  "Status",
  "Receipt Reference",
] as const;

const CSV_FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

function escapeCsvCell(value: string) {
  const sanitized = CSV_FORMULA_PREFIX_RE.test(value) ? `'${value}` : value;
  return `"${sanitized.replace(/"/g, '""')}"`;
}

type AdminTransaction = {
  publicId: string;
  type: TxType;
  amountCents: number;
  feeCents: number;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  userPublicId: string;
  userName: string;
  userEmail: string;
  counterpartyPublicId: string | null;
  counterpartyName: string | null;
  blockchainTxHash: string | null;
};

function exportToCsv(rows: AdminTransaction[]) {
  const csvContent = [
    CSV_HEADERS.join(","),
    ...rows.map((t) => {
      const amount = (t.amountCents / CENTS_TO_DOLLARS).toFixed(2);
      const fee = (t.feeCents / CENTS_TO_DOLLARS).toFixed(2);
      return [
        new Date(t.createdAt).toLocaleDateString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
        }),
        t.userName,
        t.userEmail,
        TX_TYPE_LABELS[t.type],
        amount,
        fee,
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
  link.download = `admin-transactions-${localDate}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminTransactionsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const typeFilter = TAB_TO_TYPE[activeTab];

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      "admin-transactions",
      page,
      typeFilter,
      statusFilter,
      dateFrom,
      dateTo,
      search,
    ],
    queryFn: () =>
      orpcClient.admin.transactions.list({
        page,
        type: typeFilter,
        statusId: statusFilter ? Number(statusFilter) : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
      }),
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  function handleTabChange(value: string) {
    setActiveTab(value);
    setPage(1);
  }

  const tableContent = (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Fee</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: SKELETON_ROW_COUNT }).map((_r, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholders are static
                <TableRow key={`skeleton-row-${i}`}>
                  {Array.from({ length: SKELETON_COL_COUNT }).map((_c, j) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholders are static
                    <TableCell key={`skeleton-cell-${j}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            {!isLoading &&
              data?.items.map((row) => (
                <TableRow
                  className="cursor-pointer"
                  key={row.publicId}
                  onClick={() =>
                    router.push(`/admin/transactions/${row.publicId}`)
                  }
                >
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(row.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div>
                      <Link
                        className="font-medium hover:underline"
                        href={`/admin/users/${row.userPublicId}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {row.userName}
                      </Link>
                      <p className="text-muted-foreground text-xs">
                        {row.userEmail}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>{TX_TYPE_LABELS[row.type]}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(row.amountCents / CENTS_TO_DOLLARS)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground tabular-nums">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(row.feeCents / CENTS_TO_DOLLARS)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={TX_STATUS_VARIANTS[row.status] ?? "neutral"}
                    >
                      {row.status.charAt(0).toUpperCase() + row.status.slice(1)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/transactions/${row.publicId}`);
                      }}
                      size="sm"
                      variant="outline"
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            {isError && !isLoading && (
              <TableRow>
                <TableCell
                  className="py-8 text-center"
                  colSpan={SKELETON_COL_COUNT}
                >
                  <p className="text-muted-foreground text-sm">
                    Failed to load transactions:{" "}
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
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data?.items.length === 0 && (
              <TableRow>
                <TableCell
                  className="py-8 text-center text-muted-foreground"
                  colSpan={SKELETON_COL_COUNT}
                >
                  No transactions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-muted-foreground text-sm">
            {data?.total} total transactions
          </p>
          <div className="flex gap-2">
            <Button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              size="sm"
              variant="outline"
            >
              Previous
            </Button>
            <span className="flex items-center px-3 text-sm">
              {page} / {totalPages}
            </span>
            <Button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              size="sm"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Transactions</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            View and export all transaction activity across all users.
          </p>
        </div>
        <Button
          disabled={!data?.items.length}
          onClick={() => data && exportToCsv(data.items)}
          size="sm"
          variant="outline"
        >
          <Download className="mr-2 size-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by user name or email..."
            value={search}
          />
        </div>
        <Select
          onValueChange={(value) => {
            setStatusFilter(value && value !== ALL_VALUE ? value : undefined);
            setPage(1);
          }}
          value={statusFilter ?? ALL_VALUE}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue>
              {statusFilter !== undefined
                ? (STATUS_OPTIONS.find((o) => o.value === statusFilter)
                    ?.label ?? statusFilter)
                : "All statuses"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="w-full sm:w-36"
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          placeholder="From date"
          type="date"
          value={dateFrom}
        />
        <Input
          className="w-full sm:w-36"
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          placeholder="To date"
          type="date"
          value={dateTo}
        />
      </div>

      {/* Type tabs */}
      <Tabs
        className="w-full"
        defaultValue="all"
        onValueChange={handleTabChange}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="add_money">Add Money</TabsTrigger>
          <TabsTrigger value="cash_out">Cash Out</TabsTrigger>
          <TabsTrigger value="transfer">Transfer</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-6" value="all">
          {tableContent}
        </TabsContent>
        <TabsContent className="mt-6" value="add_money">
          {tableContent}
        </TabsContent>
        <TabsContent className="mt-6" value="cash_out">
          {tableContent}
        </TabsContent>
        <TabsContent className="mt-6" value="transfer">
          {tableContent}
        </TabsContent>
      </Tabs>
    </div>
  );
}
