"use client";

import { Plus, Send } from "lucide-react";
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
import { DepositForm } from "../deposit/deposit-form";

const MYR_EXCHANGE_RATE = 4.72;

export function BalanceCard() {
  const { address, isConnected } = useConnection();

  const {
    data: balanceWei,
    isLoading,
    isError,
  } = useReadContract({
    address: ONECURRENCY_ADDRESS as `0x${string}`,
    abi: OneCurrencyABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address, // Only run if wallet is connected
      refetchInterval: 5000, // Auto-refresh every 5 seconds for that "Instant" feel
    },
  });

  const POWER_OF_18 = 18;

  const formattedBalance = balanceWei
    ? Number(formatUnits(balanceWei as bigint, POWER_OF_18))
    : 0;
  const localBalance = formattedBalance * MYR_EXCHANGE_RATE;

  if (!isConnected) {
    return null; // The parent page will handle the "Not Connected" state
  }

  let balanceContent: React.JSX.Element;

  if (isLoading) {
    balanceContent = (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-10 w-48 rounded-lg" />
        <Skeleton className="h-5 w-32 rounded-md" />
      </div>
    );
  } else if (isError) {
    balanceContent = (
      <div className="font-medium text-destructive text-sm">
        Unable to load balance. Retrying...
      </div>
    );
  } else {
    balanceContent = (
      <AmountDisplay
        align="left"
        localAmount={localBalance}
        localCurrency="RM"
        size="xl"
        usdAmount={formattedBalance}
      />
    );
  }

  return (
    <Card className="relative w-full overflow-hidden border-border shadow-sm">
      {/* Subtle background glow to make it feel premium */}
      <div className="-mr-8 -mt-8 absolute top-0 right-0 h-32 w-32 rounded-full bg-primary/5 blur-3xl" />

      <CardHeader className="pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          Total Balance
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Deterministic Feedback: Skeleton loader while fetching RPC data */}
        {balanceContent}

        {/* Quick Actions - The "Low Floor" UX */}
        <div className="grid grid-cols-2 gap-3 pt-4">
          <Dialog>
            <DialogTrigger>
              <Button className="flex w-full gap-2 font-semibold" size="lg">
                <Plus size={18} />
                Add Money
              </Button>
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

              {/* Insert our TanStack Form here */}
              <DepositForm />
            </DialogContent>
          </Dialog>

          <Button
            className="flex w-full gap-2 bg-secondary/60 font-semibold"
            size="lg"
            variant="secondary"
          >
            <Send size={18} />
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
