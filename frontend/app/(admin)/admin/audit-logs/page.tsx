"use client";

import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
const SKELETON_ROW_COUNT = 8;
const SKELETON_COL_COUNT = 6;

const ACTION_OPTIONS = [
  { value: "user.update_deposit_limit", label: "Update deposit limit" },
  { value: "user.suspend", label: "Suspend user" },
  { value: "user.restore", label: "Restore user" },
  { value: "kyc.approve", label: "KYC approve" },
  { value: "kyc.reject", label: "KYC reject" },
  { value: "blacklist.add", label: "Blacklist add" },
  { value: "blacklist.remove", label: "Blacklist remove" },
  { value: "blacklist.seize", label: "Blacklist seize" },
] as const;

const ENTITY_OPTIONS = [
  { value: "user", label: "User" },
  { value: "kyc_submission", label: "KYC Submission" },
  { value: "blacklisted_address", label: "Blacklisted Address" },
] as const;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

function JsonBlock({ value }: { value: Record<string, unknown> | null }) {
  if (!value || Object.keys(value).length === 0) {
    return <span className="text-muted-foreground text-xs italic">—</span>;
  }
  return (
    <pre className="overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs leading-relaxed">
      {JSON.stringify(value as JsonValue, null, 2)}
    </pre>
  );
}

type ChangesDialogProps = {
  action: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

function ChangesDialog({
  action,
  oldValues,
  newValues,
  metadata,
}: ChangesDialogProps) {
  const hasChanges = oldValues ?? newValues ?? metadata;
  if (!hasChanges) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        View
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm">{action}</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 space-y-4 overflow-auto">
          {oldValues && (
            <div className="space-y-1.5">
              <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Before
              </p>
              <JsonBlock value={oldValues} />
            </div>
          )}
          {newValues && (
            <div className="space-y-1.5">
              <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                After
              </p>
              <JsonBlock value={newValues} />
            </div>
          )}
          {metadata && (
            <div className="space-y-1.5">
              <p className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                Metadata
              </p>
              <JsonBlock value={metadata} />
            </div>
          )}
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string | undefined>();
  const [entityTypeFilter, setEntityTypeFilter] = useState<
    string | undefined
  >();
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: [
      "admin-audit-logs",
      page,
      search,
      actionFilter,
      entityTypeFilter,
      dateFrom,
      dateTo,
    ],
    queryFn: () =>
      orpcClient.admin.auditLogs.list({
        page,
        search: search || undefined,
        action: actionFilter,
        entityType: entityTypeFilter,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      }),
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  function resetPage() {
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Audit Logs</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Immutable record of all admin and compliance actions.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative min-w-48 flex-1">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            placeholder="Search actor, action, entity…"
            value={search}
          />
        </div>

        <Select
          onValueChange={(v) => {
            setActionFilter(v && v !== ALL_VALUE ? v : undefined);
            resetPage();
          }}
          value={actionFilter ?? ALL_VALUE}
        >
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue>
              {actionFilter
                ? (ACTION_OPTIONS.find((o) => o.value === actionFilter)
                    ?.label ?? actionFilter)
                : "All actions"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All actions</SelectItem>
            {ACTION_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          onValueChange={(v) => {
            setEntityTypeFilter(v && v !== ALL_VALUE ? v : undefined);
            resetPage();
          }}
          value={entityTypeFilter ?? ALL_VALUE}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue>
              {entityTypeFilter
                ? (ENTITY_OPTIONS.find((o) => o.value === entityTypeFilter)
                    ?.label ?? entityTypeFilter)
                : "All entity types"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All entity types</SelectItem>
            {ENTITY_OPTIONS.map((opt) => (
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
            resetPage();
          }}
          placeholder="From date"
          type="date"
          value={dateFrom}
        />
        <Input
          className="w-full sm:w-36"
          onChange={(e) => {
            setDateTo(e.target.value);
            resetPage();
          }}
          placeholder="To date"
          type="date"
          value={dateTo}
        />
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity Type</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>Changes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading &&
              Array.from({ length: SKELETON_ROW_COUNT }).map((_row, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
                <TableRow key={`skel-${i}`}>
                  {Array.from({ length: SKELETON_COL_COUNT }).map(
                    (_cell, j) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
                      <TableCell key={`skel-c-${j}`}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    )
                  )}
                </TableRow>
              ))}

            {!isLoading &&
              data?.items.map((log) => (
                <TableRow key={log.publicId}>
                  <TableCell className="text-muted-foreground text-sm tabular-nums">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {log.actorName ? (
                      <div>
                        <p className="font-medium text-sm">{log.actorName}</p>
                        <p className="text-muted-foreground text-xs">
                          {log.actorEmail}
                        </p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs italic">
                        System
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge className="font-mono text-xs" variant="outline">
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.entityType}</TableCell>
                  <TableCell className="text-muted-foreground text-sm tabular-nums">
                    {log.entityId ?? "—"}
                  </TableCell>
                  <TableCell>
                    <ChangesDialog
                      action={log.action}
                      metadata={log.metadata}
                      newValues={log.newValues}
                      oldValues={log.oldValues}
                    />
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
                    Failed to load logs:{" "}
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
                  No audit log entries found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-muted-foreground text-sm">
            {data?.total} total entries
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
