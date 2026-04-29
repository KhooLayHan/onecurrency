"use client";

import { ExternalLink, Plus, RefreshCw, Send } from "lucide-react";
import { formatUnits } from "viem";
import { useConnection, useReadContract } from "wagmi";
import {
  ONECURRENCY_ADDRESS,
  OneCurrencyABI,
} from "@/common/contracts/one-currency";
import { AmountDisplay } from "@/components/shared/amount-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useUserWallet } from "@/hooks/use-user-wallet";
import { DepositForm } from "../deposit/deposit-form";
import { SendForm } from "../transfer/send-form";

const MYR_EXCHANGE_RATE = 4.72;
const TOKEN_DECIMALS = 18;
const BALANCE_REFRESH_INTERVAL_MS = 5000;
const BALANCE_REFRESH_INTERVAL_SLOW_MS = 15_000;

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function truncateAddress(address: string): string {
  const ADDRESS_LENGTH = 6;
  const ADDRESS_LENGTH_SLICE = -4;

  return `${address.slice(0, ADDRESS_LENGTH)}...${address.slice(ADDRESS_LENGTH_SLICE)}`;
}

export function BalanceCard() {
  // Non-custodial: MetaMask / AppKit connected wallet
  const { address: connectedAddress, isConnected } = useConnection();

  // Custodial: server-managed OneCurrency checking account
  const { address: custodialAddress, isLoading: isCustodialLoading } =
    useUserWallet();

  // --- Custodial balance read (primary / hero) ---
  const {
    data: custodialBalanceWei,
    isLoading: isCustodialBalanceLoading,
    isError: isCustodialBalanceError,
    refetch: refetchCustodial,
  } = useReadContract({
    address: ONECURRENCY_ADDRESS as `0x${string}`,
    abi: OneCurrencyABI,
    functionName: "balanceOf",
    args: custodialAddress ? [custodialAddress] : undefined,
    query: {
      enabled: !!custodialAddress,
      refetchInterval: (query) =>
        query.state.error
          ? BALANCE_REFRESH_INTERVAL_SLOW_MS
          : BALANCE_REFRESH_INTERVAL_MS,
      retry: 2,
    },
  });

  // --- Connected (MetaMask) balance read (informational only) ---
  const { data: connectedBalanceWei } = useReadContract({
    address: ONECURRENCY_ADDRESS as `0x${string}`,
    abi: OneCurrencyABI,
    functionName: "balanceOf",
    args: connectedAddress ? [connectedAddress] : undefined,
    query: {
      enabled: !!connectedAddress,
      refetchInterval: BALANCE_REFRESH_INTERVAL_MS,
      retry: 2,
    },
  });

  const custodialBalance = custodialBalanceWei
    ? Number(formatUnits(custodialBalanceWei as bigint, TOKEN_DECIMALS))
    : 0;

  const connectedBalance = connectedBalanceWei
    ? Number(formatUnits(connectedBalanceWei as bigint, TOKEN_DECIMALS))
    : 0;

  const localBalance = custodialBalance * MYR_EXCHANGE_RATE;

  // Show skeleton while we're waiting to learn whether user has a custodial
  // wallet (and MetaMask isn't connected as a fallback indicator).
  if (isCustodialLoading) {
    return (
      <Card className="relative w-full overflow-hidden border-border shadow-sm">
        <div className="-mr-8 -mt-8 absolute top-0 right-0 size-32 rounded-full bg-primary/5 blur-3xl" />
        <CardHeader className="pb-2">
          <CardTitle className="font-medium text-muted-foreground text-sm">
            OneCurrency Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-2">
            <Skeleton className="h-10 w-48 rounded-lg" />
            <Skeleton className="h-5 w-32 rounded-md" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No custodial wallet found — prompt to connect via AppKit
  if (!custodialAddress) {
    return (
      <Card className="relative w-full overflow-hidden border-border shadow-sm">
        <div className="-mr-8 -mt-8 absolute top-0 right-0 size-32 rounded-full bg-primary/5 blur-3xl" />
        <CardHeader className="pb-2">
          <CardTitle className="font-medium text-muted-foreground text-sm">
            OneCurrency Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="mb-4 max-w-xs text-muted-foreground text-sm">
              Connect your account to view your balance and make transactions.
            </p>
            <appkit-button />
          </div>
        </CardContent>
      </Card>
    );
  }

  // --- Hero balance content (custodial) ---
  let heroContent: React.JSX.Element;

  if (isCustodialBalanceLoading) {
    heroContent = (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-5 w-32 rounded-md" />
      </div>
    );
  } else if (isCustodialBalanceError) {
    heroContent = (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-3xl text-muted-foreground tabular-nums">
            —
          </span>
          <Button
            aria-label="Retry loading balance"
            className="min-h-11 min-w-11"
            onClick={() => refetchCustodial()}
            size="icon"
            title="Retry"
            variant="ghost"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
        <span className="flex items-center gap-1 text-muted-foreground text-xs">
          <span className="inline-block size-1.5 rounded-full bg-highlight-500" />
          Network unavailable
        </span>
      </div>
    );
  } else {
    heroContent = (
      <AmountDisplay
        align="left"
        localAmount={localBalance}
        localCurrency="RM"
        size="xl"
        usdAmount={custodialBalance}
      />
    );
  }

  return (
    <Card className="relative w-full overflow-hidden border-border shadow-sm">
      {/* Subtle background glow */}
      <div className="-mr-8 -mt-8 absolute top-0 right-0 size-32 rounded-full bg-primary/5 blur-3xl" />

      <CardHeader className="pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          OneCurrency Account
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Primary (custodial) balance */}
        {heroContent}

        {/* External Linked Account row — informational, only when MetaMask is connected */}
        {isConnected && connectedAddress && (
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span className="font-medium text-sm">
                  External Linked Account
                </span>
                <span className="font-mono text-muted-foreground text-xs">
                  {truncateAddress(connectedAddress)}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-semibold text-sm tabular-nums">
                {formatUsd(connectedBalance)}
              </span>
              <Tooltip>
                <TooltipTrigger className="cursor-not-allowed text-muted-foreground text-xs underline-offset-2 hover:underline">
                  Transfer
                </TooltipTrigger>
                <TooltipContent>
                  <p>Managed Recovery — coming soon</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 pt-4">
          <Dialog>
            <DialogTrigger
              render={
                <Button className="flex w-full gap-2 font-semibold" size="lg" />
              }
            >
              <Plus className="size-4.5" />
              Add Money
            </DialogTrigger>

            <DialogContent className="rounded-2xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-bold text-2xl">
                  Top Up Account
                </DialogTitle>
                <DialogDescription>
                  Enter the amount of USD you want to add. This will be
                  instantly converted to OneCurrency.
                </DialogDescription>
              </DialogHeader>

              <DepositForm />
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger
              render={
                <Button
                  className="flex w-full gap-2 bg-secondary/60 font-semibold"
                  size="lg"
                  variant="secondary"
                />
              }
            >
              <Send className="size-4.5" />
              Send
            </DialogTrigger>

            <DialogContent className="rounded-2xl sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="font-bold text-2xl">
                  Send Money
                </DialogTitle>
                <DialogDescription>
                  Send funds instantly to another OneCurrency user.
                </DialogDescription>
              </DialogHeader>

              <SendForm />
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
}
