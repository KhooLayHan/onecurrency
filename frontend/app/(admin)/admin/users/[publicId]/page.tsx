"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { KYC_STATUS } from "@/common/constants/kyc";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const HTTP_STATUS_NOT_FOUND = 404;
const CENTS_TO_DOLLARS = 100;
const CENTS_PER_DOLLAR = 100;
const SKELETON_TX_ROW_COUNT = 5;
const SKELETON_TX_COL_COUNT = 6;

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
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="shrink-0 text-muted-foreground text-sm">{label}</span>
      <span className="text-right text-sm">{value}</span>
    </div>
  );
}

export default function AdminUserDetailPage() {
  const { publicId } = useParams<{ publicId: string }>();
  const queryClient = useQueryClient();

  const [txPage, setTxPage] = useState(1);
  const [editingLimit, setEditingLimit] = useState(false);
  const [limitInput, setLimitInput] = useState("");
  const [pendingAction, setPendingAction] = useState<
    "suspend" | "restore" | null
  >(null);

  const {
    data: user,
    isLoading: userLoading,
    isError: userError,
    error: userQueryError,
  } = useQuery({
    queryKey: ["admin-user", publicId],
    queryFn: () => orpcClient.admin.users.get({ publicId }),
  });

  const { data: txData, isLoading: txLoading } = useQuery({
    queryKey: ["admin-user-transactions", publicId, txPage],
    queryFn: () =>
      orpcClient.admin.transactions.list({
        page: txPage,
        search: user?.email,
      }),
    enabled: !!user?.email,
  });

  const updateLimitMutation = useMutation({
    mutationFn: (depositLimitCents: number) =>
      orpcClient.admin.users.updateDepositLimit({
        publicId,
        depositLimitCents,
      }),
    onSuccess: () => {
      toast.success("Deposit limit updated");
      queryClient.invalidateQueries({ queryKey: ["admin-user", publicId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setEditingLimit(false);
    },
    onError: (error) => {
      toast.error("Failed to update deposit limit", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const suspendMutation = useMutation({
    mutationFn: () => orpcClient.admin.users.suspend({ publicId }),
    onSuccess: () => {
      toast.success("User suspended");
      queryClient.invalidateQueries({ queryKey: ["admin-user", publicId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setPendingAction(null);
    },
    onError: (error) => {
      toast.error("Failed to suspend user", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: () => orpcClient.admin.users.restore({ publicId }),
    onSuccess: () => {
      toast.success("User restored");
      queryClient.invalidateQueries({ queryKey: ["admin-user", publicId] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setPendingAction(null);
    },
    onError: (error) => {
      toast.error("Failed to restore user", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  function handleSaveLimit() {
    const dollars = Number.parseFloat(limitInput);
    if (Number.isNaN(dollars) || dollars < 0) {
      toast.error("Enter a valid deposit limit amount");
      return;
    }
    const cents = Math.round(dollars * CENTS_PER_DOLLAR);
    updateLimitMutation.mutate(cents);
  }

  function handleEditLimit() {
    if (!user) return;
    setLimitInput((user.depositLimitCents / CENTS_TO_DOLLARS).toFixed(2));
    setEditingLimit(true);
  }

  const isSuspended = user?.deletedAt !== null && user?.deletedAt !== undefined;
  const txTotalPages = txData ? Math.ceil(txData.total / txData.pageSize) : 0;

  // 404 state
  if (
    userError &&
    userQueryError &&
    "status" in userQueryError &&
    (userQueryError as { status: number }).status === HTTP_STATUS_NOT_FOUND
  ) {
    return (
      <div className="space-y-4">
        <Link
          className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
          href="/admin/users"
        >
          <ArrowLeft className="size-4" />
          Users
        </Link>
        <div className="py-16 text-center text-muted-foreground">
          User not found.
        </div>
      </div>
    );
  }

  // Generic error state
  if (userError && !userLoading) {
    return (
      <div className="space-y-4">
        <Link
          className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
          href="/admin/users"
        >
          <ArrowLeft className="size-4" />
          Users
        </Link>
        <div className="py-16 text-center text-muted-foreground text-sm">
          Failed to load user:{" "}
          {userQueryError instanceof Error
            ? userQueryError.message
            : "Unknown error"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground"
            href="/admin/users"
          >
            <ArrowLeft className="size-4" />
            Users
          </Link>
          {userLoading ? (
            <Skeleton className="h-7 w-48" />
          ) : (
            <div className="flex items-center gap-2.5">
              <h1 className="font-bold text-xl tracking-tight">{user?.name}</h1>
              {isSuspended ? (
                <Badge variant="error">Suspended</Badge>
              ) : (
                <Badge variant="success">Active</Badge>
              )}
            </div>
          )}
        </div>

        {!userLoading && user && (
          <Button
            disabled={suspendMutation.isPending || restoreMutation.isPending}
            onClick={() =>
              setPendingAction(isSuspended ? "restore" : "suspend")
            }
            size="sm"
            variant={isSuspended ? "outline" : "destructive"}
          >
            {isSuspended ? "Restore Account" : "Suspend Account"}
          </Button>
        )}
      </div>

      <Tabs className="w-full" defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transaction History</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent className="mt-6" value="overview">
          {userLoading ? (
            <div className="grid gap-6 md:grid-cols-2">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          ) : (
            user && (
              <div className="grid gap-6 md:grid-cols-2">
                {/* Profile card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Profile</CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y">
                    <InfoRow label="Name" value={user.name} />
                    <InfoRow label="Email" value={user.email} />
                    <InfoRow
                      label="Email verified"
                      value={
                        user.emailVerified ? (
                          <Badge variant="success">Verified</Badge>
                        ) : (
                          <Badge variant="neutral">Unverified</Badge>
                        )
                      }
                    />
                    <InfoRow
                      label="KYC status"
                      value={
                        <Badge
                          variant={
                            KYC_STATUS_VARIANTS[user.kycStatusId] ?? "neutral"
                          }
                        >
                          {KYC_STATUS_LABELS[user.kycStatusId] ?? "Unknown"}
                        </Badge>
                      }
                    />
                    {user.kycVerifiedAt && (
                      <InfoRow
                        label="KYC verified"
                        value={new Date(
                          user.kycVerifiedAt
                        ).toLocaleDateString()}
                      />
                    )}
                    <InfoRow
                      label="Roles"
                      value={
                        <div className="flex flex-wrap justify-end gap-1">
                          {user.roles.length === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            user.roles.map((role) => (
                              <Badge key={role} variant="outline">
                                {role}
                              </Badge>
                            ))
                          )}
                        </div>
                      }
                    />
                    <InfoRow
                      label="Created"
                      value={new Date(user.createdAt).toLocaleDateString()}
                    />
                    <InfoRow
                      label="Updated"
                      value={new Date(user.updatedAt).toLocaleDateString()}
                    />
                  </CardContent>
                </Card>

                {/* Account card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Account Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="space-y-2">
                      <Label className="text-sm">Deposit Limit</Label>
                      {editingLimit ? (
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <span className="-translate-y-1/2 absolute top-1/2 left-3 text-muted-foreground text-sm">
                              $
                            </span>
                            <Input
                              className="pl-7"
                              inputMode="decimal"
                              onChange={(e) => setLimitInput(e.target.value)}
                              placeholder="0.00"
                              type="number"
                              value={limitInput}
                            />
                          </div>
                          <Button
                            disabled={updateLimitMutation.isPending}
                            onClick={handleSaveLimit}
                            size="sm"
                          >
                            {updateLimitMutation.isPending
                              ? "Saving..."
                              : "Save"}
                          </Button>
                          <Button
                            disabled={updateLimitMutation.isPending}
                            onClick={() => setEditingLimit(false)}
                            size="sm"
                            variant="outline"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-sm tabular-nums">
                            {new Intl.NumberFormat("en-US", {
                              style: "currency",
                              currency: "USD",
                            }).format(
                              user.depositLimitCents / CENTS_TO_DOLLARS
                            )}
                          </span>
                          <Button
                            onClick={handleEditLimit}
                            size="sm"
                            variant="outline"
                          >
                            Edit
                          </Button>
                        </div>
                      )}
                    </div>

                    {isSuspended && user.deletedAt && (
                      <div className="space-y-1">
                        <Label className="text-sm">Suspended At</Label>
                        <p className="text-muted-foreground text-sm">
                          {new Date(user.deletedAt).toLocaleString()}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )
          )}
        </TabsContent>

        {/* Transaction History tab */}
        <TabsContent className="mt-6" value="transactions">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Receipt Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txLoading &&
                  Array.from({ length: SKELETON_TX_ROW_COUNT }).map((_r, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholders are static
                    <TableRow key={`tx-skeleton-${i}`}>
                      {Array.from({
                        length: SKELETON_TX_COL_COUNT,
                      }).map((_c, j) => (
                        // biome-ignore lint/suspicious/noArrayIndexKey: Skeleton placeholders are static
                        <TableCell key={`tx-skeleton-cell-${j}`}>
                          <Skeleton className="h-4 w-full" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                {!txLoading &&
                  txData?.items.map((tx) => (
                    <TableRow
                      className="cursor-pointer"
                      key={tx.publicId}
                      onClick={() =>
                        window.open(
                          `/admin/transactions/${tx.publicId}`,
                          "_self"
                        )
                      }
                    >
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {TX_TYPE_LABELS[tx.type] ?? tx.type}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                        }).format(tx.amountCents / CENTS_TO_DOLLARS)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground tabular-nums">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                        }).format(tx.feeCents / CENTS_TO_DOLLARS)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={TX_STATUS_VARIANTS[tx.status] ?? "neutral"}
                        >
                          {tx.status.charAt(0).toUpperCase() +
                            tx.status.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground text-xs">
                        {tx.publicId}
                      </TableCell>
                    </TableRow>
                  ))}
                {!txLoading && txData?.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      className="py-8 text-center text-muted-foreground"
                      colSpan={SKELETON_TX_COL_COUNT}
                    >
                      No transactions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {txTotalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-muted-foreground text-sm">
                {txData?.total} total transactions
              </p>
              <div className="flex gap-2">
                <Button
                  disabled={txPage === 1}
                  onClick={() => setTxPage((p) => p - 1)}
                  size="sm"
                  variant="outline"
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm">
                  {txPage} / {txTotalPages}
                </span>
                <Button
                  disabled={txPage === txTotalPages}
                  onClick={() => setTxPage((p) => p + 1)}
                  size="sm"
                  variant="outline"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Suspend / Restore confirmation dialog */}
      <AlertDialog
        onOpenChange={(open) => !open && setPendingAction(null)}
        open={!!pendingAction}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction === "suspend"
                ? "Suspend Account?"
                : "Restore Account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction === "suspend"
                ? `This will immediately sign out ${
                    user?.name ?? "this user"
                  } and prevent them from logging in. You can restore the account at any time.`
                : `This will restore ${
                    user?.name ?? "this user"
                  }'s access and allow them to log in again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={suspendMutation.isPending || restoreMutation.isPending}
              onClick={() => {
                if (pendingAction === "suspend") {
                  suspendMutation.mutate();
                } else if (pendingAction === "restore") {
                  restoreMutation.mutate();
                }
              }}
              variant={pendingAction === "suspend" ? "destructive" : "default"}
            >
              {suspendMutation.isPending || restoreMutation.isPending
                ? "Processing..."
                : pendingAction === "suspend"
                  ? "Suspend"
                  : "Restore"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
