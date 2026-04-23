"use client";

import { ArrowRight, Info, Receipt, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { BalanceCard } from "@/components/features/dashboard/balance-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSession } from "@/lib/auth-client";

// KYC Status IDs from database schema
const KYC_STATUS_NONE = 1;
const KYC_STATUS_PENDING = 2;
const KYC_STATUS_VERIFIED = 3;

// Exchange rate constant
const MYR_EXCHANGE_RATE = 4.72;

// Time boundaries for greetings
const MORNING_END_HOUR = 12;
const AFTERNOON_END_HOUR = 17;

function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < MORNING_END_HOUR) {
    return "Good morning";
  }
  if (hour < AFTERNOON_END_HOUR) {
    return "Good afternoon";
  }
  return "Good evening";
}

function getKycBadgeVariant(
  statusId: number
): "secondary" | "default" | "outline" {
  switch (statusId) {
    case KYC_STATUS_VERIFIED:
      return "default";
    case KYC_STATUS_PENDING:
      return "outline";
    default:
      return "secondary";
  }
}

function getKycStatusLabel(statusId: number): string {
  switch (statusId) {
    case KYC_STATUS_VERIFIED:
      return "Verified";
    case KYC_STATUS_PENDING:
      return "Pending";
    default:
      return "Not Started";
  }
}

export default function DashboardPage() {
  const { data: session, isPending } = useSession();

  // Loading state
  if (isPending) {
    return (
      <div className="fade-in flex animate-in flex-col gap-6 duration-300 ease-out">
        <div>
          <Skeleton className="mb-2 h-8 w-64" />
          <Skeleton className="h-5 w-48" />
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          <div className="flex flex-col gap-6 md:col-span-7 lg:col-span-8">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <div className="hidden md:col-span-5 md:block lg:col-span-4">
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated - prompt to sign in
  if (!session) {
    return (
      <div className="fade-in flex animate-in flex-col gap-6 duration-300 ease-out">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Dashboard</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            Manage your global funds securely.
          </p>
        </div>

        <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
          <div className="mb-6 flex size-20 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="size-10 text-primary" />
          </div>
          <h2 className="mb-2 font-bold text-2xl">Welcome to OneCurrency</h2>
          <p className="mx-auto mb-8 max-w-md text-muted-foreground">
            Sign in to access your secure global balance and start managing your
            funds.
          </p>
          <Button render={<Link href="/login" />} size="lg">
            Sign in to continue
          </Button>
        </div>
      </div>
    );
  }

  const kycStatusId = session.user.kycStatusId ?? KYC_STATUS_NONE;
  const greeting = getTimeOfDayGreeting();
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  return (
    <div className="fade-in flex animate-in flex-col gap-6 duration-300 ease-out">
      {/* Page Header with Greeting */}
      <div>
        <h1 className="font-bold text-2xl tracking-tight">
          {greeting}, {firstName}!
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Here's your account overview.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        {/* Main Column */}
        <div className="flex flex-col gap-6 md:col-span-7 lg:col-span-8">
          <BalanceCard />

          {/* Recent Activity Section */}
          <div className="pt-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-lg">Recent Activity</h2>
              <Link
                className="flex items-center gap-1 text-muted-foreground text-sm transition-colors hover:text-foreground"
                href="/history"
              >
                View all
                <ArrowRight className="size-4" />
              </Link>
            </div>
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 p-12 text-center">
              <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-secondary">
                <Receipt className="size-6 text-muted-foreground" />
              </div>
              <h3 className="font-medium text-base">No activity yet</h3>
              <p className="mt-1 max-w-sm text-muted-foreground text-sm">
                When you add money to your account, your transactions will
                appear here.
              </p>
            </div>
          </div>
        </div>

        {/* Right Sidebar (Desktop only) */}
        <div className="hidden md:col-span-5 md:block lg:col-span-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="font-semibold text-base">
                Account Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Network Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-sm">Network</span>
                </div>
                <Badge variant="outline">Operational</Badge>
              </div>

              {/* Identity Verification */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="size-4 text-muted-foreground" />
                  <span className="text-sm">Identity</span>
                </div>
                <Link href="/profile">
                  <Badge
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    variant={getKycBadgeVariant(kycStatusId)}
                  >
                    {getKycStatusLabel(kycStatusId)}
                  </Badge>
                </Link>
              </div>

              <Separator />

              {/* Exchange Rate */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground text-sm">
                    Today's Rate
                  </span>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="size-3.5 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Exchange rate updated daily at midnight UTC</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="font-medium text-sm tabular-nums">
                  $1 = RM {MYR_EXCHANGE_RATE.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
