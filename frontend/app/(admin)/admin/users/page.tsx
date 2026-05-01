"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { KYC_STATUS } from "@/common/constants/kyc";
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
import { orpcClient } from "@/lib/api";

const ALL_VALUE = "all";
const SKELETON_ROW_COUNT = 5;
const SKELETON_COL_COUNT = 7;
const CENTS_TO_DOLLARS = 100;

const KYC_STATUS_LABELS: Record<number, string> = {
  [KYC_STATUS.NONE]: "None",
  [KYC_STATUS.PENDING]: "Pending",
  [KYC_STATUS.VERIFIED]: "Verified",
  [KYC_STATUS.REJECTED]: "Rejected",
  [KYC_STATUS.EXPIRED]: "Expired",
};

const KYC_STATUS_VARIANTS: Record<
  number,
  "neutral" | "warning" | "success" | "error"
> = {
  [KYC_STATUS.NONE]: "neutral",
  [KYC_STATUS.PENDING]: "warning",
  [KYC_STATUS.VERIFIED]: "success",
  [KYC_STATUS.REJECTED]: "error",
  [KYC_STATUS.EXPIRED]: "warning",
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "compliance", label: "Compliance" },
  { value: "support", label: "Support" },
  { value: "user", label: "User" },
];

export default function AdminUsersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [kycStatusFilter, setKycStatusFilter] = useState<number | undefined>();
  const [roleFilter, setRoleFilter] = useState<string | undefined>();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-users", page, search, kycStatusFilter, roleFilter],
    queryFn: () =>
      orpcClient.admin.users.list({
        page,
        search: search || undefined,
        kycStatusId: kycStatusFilter,
        role: roleFilter,
      }),
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Users</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage user accounts, KYC status, and deposit limits.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email..."
            value={search}
          />
        </div>
        <Select
          onValueChange={(value) => {
            setKycStatusFilter(value === ALL_VALUE ? undefined : Number(value));
            setPage(1);
          }}
          value={
            kycStatusFilter !== undefined ? String(kycStatusFilter) : ALL_VALUE
          }
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue>
              {kycStatusFilter !== undefined
                ? (KYC_STATUS_LABELS[kycStatusFilter] ??
                  String(kycStatusFilter))
                : "All KYC statuses"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All KYC statuses</SelectItem>
            <SelectItem value={String(KYC_STATUS.NONE)}>None</SelectItem>
            <SelectItem value={String(KYC_STATUS.PENDING)}>Pending</SelectItem>
            <SelectItem value={String(KYC_STATUS.VERIFIED)}>
              Verified
            </SelectItem>
            <SelectItem value={String(KYC_STATUS.REJECTED)}>
              Rejected
            </SelectItem>
            <SelectItem value={String(KYC_STATUS.EXPIRED)}>Expired</SelectItem>
          </SelectContent>
        </Select>
        <Select
          onValueChange={(value) => {
            setRoleFilter(value && value !== ALL_VALUE ? value : undefined);
            setPage(1);
          }}
          value={roleFilter ?? ALL_VALUE}
        >
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue>
              {roleFilter !== undefined
                ? (ROLE_OPTIONS.find((o) => o.value === roleFilter)?.label ??
                  roleFilter)
                : "All roles"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All roles</SelectItem>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>KYC Status</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Deposit Limit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: SKELETON_ROW_COUNT }).map((_row, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholders are static
                <TableRow key={`skeleton-row-${i}`}>
                  {Array.from({ length: SKELETON_COL_COUNT }).map(
                    (_cell, j) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholders are static
                      <TableCell key={`skeleton-cell-${j}`}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    )
                  )}
                </TableRow>
              ))}
            {!isLoading &&
              data?.items.map((row) => (
                <TableRow
                  className="cursor-pointer"
                  key={row.publicId}
                  onClick={() => router.push(`/admin/users/${row.publicId}`)}
                >
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.email}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        KYC_STATUS_VARIANTS[row.kycStatusId] ?? "neutral"
                      }
                    >
                      {KYC_STATUS_LABELS[row.kycStatusId] ?? "Unknown"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {row.roles.length === 0 ? (
                        <span className="text-muted-foreground text-xs">—</span>
                      ) : (
                        row.roles.map((role) => (
                          <Badge key={role} variant="outline">
                            {role}
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: "USD",
                    }).format(row.depositLimitCents / CENTS_TO_DOLLARS)}
                  </TableCell>
                  <TableCell>
                    {row.deletedAt !== null ? (
                      <Badge variant="error">Suspended</Badge>
                    ) : (
                      <Badge variant="success">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(row.createdAt).toLocaleDateString()}
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
                    Failed to load users:{" "}
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
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {data?.total} total users
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
    </div>
  );
}
