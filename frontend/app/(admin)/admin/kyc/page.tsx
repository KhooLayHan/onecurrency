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

const STATUS_LABEL: Record<number, string> = {
  [KYC_STATUS.NONE]: "None",
  [KYC_STATUS.PENDING]: "Pending",
  [KYC_STATUS.VERIFIED]: "Verified",
  [KYC_STATUS.REJECTED]: "Rejected",
  [KYC_STATUS.EXPIRED]: "Expired",
};

const STATUS_VARIANT: Record<
  number,
  "default" | "warning" | "success" | "destructive" | "primary"
> = {
  [KYC_STATUS.NONE]: "default",
  [KYC_STATUS.PENDING]: "warning",
  [KYC_STATUS.VERIFIED]: "success",
  [KYC_STATUS.REJECTED]: "destructive",
  [KYC_STATUS.EXPIRED]: "warning",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  passport: "Passport",
  drivers_license: "Driver's License",
  national_id: "National ID",
};

export default function KycSubmissionsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<number | undefined>();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["admin-kyc-submissions", page, search, statusFilter],
    queryFn: () =>
      orpcClient.admin.kyc.listSubmissions({
        page,
        search: search || undefined,
        kycStatusId: statusFilter,
      }),
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">KYC Submissions</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Review identity verification requests from users.
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
            setStatusFilter(value ? Number(value) : undefined);
            setPage(1);
          }}
          value={statusFilter !== undefined ? String(statusFilter) : ""}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All statuses</SelectItem>
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
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Document</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_row, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholders are static
                  <TableRow key={`skeleton-row-${i}`}>
                    {Array.from({ length: 6 }).map((_cell, j) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholders are static
                      <TableCell key={`skeleton-cell-${j}`}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : data?.items.map((row) => (
                  <TableRow
                    className="cursor-pointer"
                    key={row.publicId}
                    onClick={() => router.push(`/admin/kyc/${row.publicId}`)}
                  >
                    <TableCell className="font-medium">
                      {row.fullName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.userEmail}
                    </TableCell>
                    <TableCell>
                      {DOC_TYPE_LABEL[row.documentType] ?? row.documentType}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANT[row.kycStatusId] ?? "default"}
                      >
                        {STATUS_LABEL[row.kycStatusId] ?? "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/admin/kyc/${row.publicId}`);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            {isError && !isLoading && (
              <TableRow>
                <TableCell className="py-8 text-center" colSpan={6}>
                  <p className="text-muted-foreground text-sm">
                    Failed to load submissions:{" "}
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
                  colSpan={6}
                >
                  No submissions found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {data?.total} total submissions
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
