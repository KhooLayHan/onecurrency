"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Shield, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { orpcClient } from "@/lib/api";

const DEFAULT_NETWORK_ID = 1;

type PendingAction =
  | { type: "remove"; publicId: string; address: string }
  | { type: "seize"; publicId: string; address: string }
  | null;

export default function BlacklistPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const [newAddress, setNewAddress] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newSource, setNewSource] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-blacklist", page, search],
    queryFn: () =>
      orpcClient.admin.blacklist.list({
        page,
        search: search || undefined,
      }),
  });

  const addMutation = useMutation({
    mutationFn: () =>
      orpcClient.admin.blacklist.add({
        address: newAddress,
        networkId: DEFAULT_NETWORK_ID,
        reason: newReason,
        source: newSource || undefined,
      }),
    onSuccess: () => {
      toast.success("Address blacklisted", {
        description:
          "The address has been added to the DB and blacklisted on-chain.",
      });
      queryClient.invalidateQueries({ queryKey: ["admin-blacklist"] });
      setAddOpen(false);
      setNewAddress("");
      setNewReason("");
      setNewSource("");
    },
    onError: (error) => {
      toast.error("Failed to blacklist address", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (publicId: string) =>
      orpcClient.admin.blacklist.remove({ publicId }),
    onSuccess: () => {
      toast.success("Address removed from blacklist");
      queryClient.invalidateQueries({ queryKey: ["admin-blacklist"] });
      setPendingAction(null);
    },
    onError: (error) => {
      toast.error("Failed to remove address", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const seizeMutation = useMutation({
    mutationFn: (publicId: string) =>
      orpcClient.admin.blacklist.seize({ publicId }),
    onSuccess: () => {
      toast.success("Tokens seized successfully");
      setPendingAction(null);
    },
    onError: (error) => {
      toast.error("Seizure failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    },
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 0;
  const isAddressValid = /^0x[a-fA-F0-9]{40}$/.test(newAddress);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">
            Blacklist Manager
          </h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Manage on-chain and off-chain blacklisted addresses.
          </p>
        </div>
        <Button className="gap-2" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Add Address
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-muted-foreground" />
        <Input
          className="pl-9"
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search address..."
          value={search}
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Address</TableHead>
              <TableHead>Network</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Added By</TableHead>
              <TableHead>Added At</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : data?.items.map((row) => (
                  <TableRow key={row.publicId}>
                    <TableCell>
                      <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                        {row.address.slice(0, 8)}...{row.address.slice(-6)}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="default">
                        {row.networkName ?? `Network ${row.networkId}`}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-sm">
                      {row.reason}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.addedByName ?? "System"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(row.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          onClick={() =>
                            setPendingAction({
                              type: "seize",
                              publicId: row.publicId,
                              address: row.address,
                            })
                          }
                          size="sm"
                          title="Seize tokens"
                          variant="outline"
                        >
                          <Zap className="size-3.5" />
                        </Button>
                        <Button
                          onClick={() =>
                            setPendingAction({
                              type: "remove",
                              publicId: row.publicId,
                              address: row.address,
                            })
                          }
                          size="sm"
                          title="Remove from blacklist"
                          variant="outline"
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            {!isLoading && data?.items.length === 0 && (
              <TableRow>
                <TableCell
                  className="py-8 text-center text-muted-foreground"
                  colSpan={6}
                >
                  No blacklisted addresses.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {data?.total} total addresses
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

      <Dialog onOpenChange={setAddOpen} open={addOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="size-5" />
              Add to Blacklist
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Ethereum Address</Label>
              <Input
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="0x..."
                value={newAddress}
              />
              {newAddress && !isAddressValid && (
                <p className="text-destructive text-xs">
                  Invalid Ethereum address
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Reason</Label>
              <Textarea
                onChange={(e) => setNewReason(e.target.value)}
                placeholder="Why is this address being blacklisted?"
                rows={2}
                value={newReason}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source (optional)</Label>
              <Input
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="e.g. OFAC SDN, manual review"
                value={newSource}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setAddOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button
              disabled={
                !isAddressValid || newReason.length < 5 || addMutation.isPending
              }
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? "Blacklisting..." : "Blacklist Address"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => !open && setPendingAction(null)}
        open={!!pendingAction}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === "seize"
                ? "Seize Tokens?"
                : "Remove from Blacklist?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === "seize"
                ? `This will call seizeTokens() on-chain and transfer all tokens from ${pendingAction?.address.slice(
                    0,
                    10
                  )}... to the treasury. This cannot be undone.`
                : `This will call unblacklistAccount() on-chain for ${pendingAction?.address.slice(
                    0,
                    10
                  )}... and remove the DB record.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={removeMutation.isPending || seizeMutation.isPending}
              onClick={() => {
                if (!pendingAction) {
                  return;
                }
                if (pendingAction.type === "remove") {
                  removeMutation.mutate(pendingAction.publicId);
                } else {
                  seizeMutation.mutate(pendingAction.publicId);
                }
              }}
              variant={
                pendingAction?.type === "seize" ? "destructive" : "default"
              }
            >
              {removeMutation.isPending || seizeMutation.isPending
                ? "Processing..."
                : pendingAction?.type === "seize"
                  ? "Seize Tokens"
                  : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
