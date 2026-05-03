"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ClipboardCheck,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { orpcClient } from "@/lib/api";

const CENTS_TO_DOLLARS = 100;
const RECENT_AUDIT_COUNT = 5;
const PERCENTAGE_MULTIPLIER = 100;

type KycKey = "none" | "pending" | "verified" | "rejected" | "expired";

const KYC_LABELS: Record<KycKey, string> = {
  none: "Not Started",
  pending: "Pending",
  verified: "Verified",
  rejected: "Rejected",
  expired: "Expired",
};

const KYC_VARIANTS: Record<
  KycKey,
  "neutral" | "warning" | "success" | "error" | "primary"
> = {
  none: "neutral",
  pending: "warning",
  verified: "success",
  rejected: "error",
  expired: "neutral",
};

const KYC_KEYS: KycKey[] = [
  "none",
  "pending",
  "verified",
  "rejected",
  "expired",
];

function formatUSD(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / CENTS_TO_DOLLARS);
}

type StatCardProps = {
  title: string;
  value: string | number | null;
  sub: ReactNode;
  icon: ReactNode;
  alert?: boolean;
};

function StatCard({ title, value, sub, icon, alert = false }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          {title}
        </CardTitle>
        <span className={alert ? "text-destructive" : "text-muted-foreground"}>
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        {value === null ? (
          <>
            <Skeleton className="mb-1.5 h-7 w-20" />
            <Skeleton className="h-3.5 w-28" />
          </>
        ) : (
          <>
            <p
              className={`font-bold text-2xl tabular-nums ${alert ? "text-destructive" : ""}`}
            >
              {value}
            </p>
            <p className="mt-0.5 text-muted-foreground text-xs">{sub}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type TxCardProps = {
  label: string;
  icon: ReactNode;
  count: number | undefined;
  totalCents: number | undefined;
  isLoading: boolean;
};

function TxCard({ label, icon, count, totalCents, isLoading }: TxCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">
          {label}
        </CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="mb-1.5 h-7 w-28" />
            <Skeleton className="h-3.5 w-20" />
          </>
        ) : (
          <>
            <p className="font-bold text-2xl tabular-nums">
              {formatUSD(totalCents ?? 0)}
            </p>
            <p className="mt-0.5 text-muted-foreground text-xs">
              {count ?? 0} completed transactions
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type AuditLogItem = {
  publicId: string;
  action: string;
  actorName: string | null;
  entityType: string;
  entityId: string | null;
  createdAt: Date;
};

type AuditActivityContentProps = {
  isLoading: boolean;
  items: AuditLogItem[] | undefined;
};

function AuditActivityContent({ isLoading, items }: AuditActivityContentProps) {
  if (isLoading) {
    return (
      <div className="space-y-px px-6 pt-2 pb-4">
        {Array.from({ length: RECENT_AUDIT_COUNT }).map((_item, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
          <Skeleton className="h-12 w-full rounded-md" key={i} />
        ))}
      </div>
    );
  }
  if (!items || items.length === 0) {
    return (
      <p className="px-6 py-6 text-center text-muted-foreground text-sm">
        No audit events recorded yet.
      </p>
    );
  }
  return (
    <div className="divide-y">
      {items.slice(0, RECENT_AUDIT_COUNT).map((log) => (
        <div
          className="flex items-center justify-between px-6 py-3"
          key={log.publicId}
        >
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-sm">{log.action}</span>
            <span className="text-muted-foreground text-xs">
              {log.actorName ?? "System"} · {log.entityType}
              {log.entityId ? ` #${log.entityId}` : ""}
            </span>
          </div>
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {new Date(log.createdAt).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["admin-metrics"],
    queryFn: () => orpcClient.admin.metrics.getSummary({}),
  });

  const { data: recentLogs, isLoading: logsLoading } = useQuery({
    queryKey: ["admin-audit-logs", "recent"],
    queryFn: () => orpcClient.admin.auditLogs.list({ page: 1 }),
  });

  const totalVolumeCents =
    (metrics?.transactionVolume.deposits.totalAmountCents ?? 0) +
    (metrics?.transactionVolume.withdrawals.totalAmountCents ?? 0) +
    (metrics?.transactionVolume.transfers.totalAmountCents ?? 0);

  const totalUsers = metrics?.totalUsers ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Platform-wide summary and key metrics.
        </p>
      </div>

      {/* Top-level stat cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          icon={<Users className="size-4" />}
          sub={
            isLoading
              ? null
              : `+${metrics?.newUsersLast30Days ?? 0} new this month`
          }
          title="Total Users"
          value={isLoading ? null : (metrics?.totalUsers ?? 0)}
        />
        <StatCard
          icon={<ClipboardCheck className="size-4" />}
          sub={
            <Link className="text-primary hover:underline" href="/admin/kyc">
              Review submissions
            </Link>
          }
          title="Pending KYC"
          value={isLoading ? null : (metrics?.pendingKycSubmissions ?? 0)}
        />
        <StatCard
          icon={<TrendingUp className="size-4" />}
          sub="Completed, all time"
          title="Transaction Volume"
          value={isLoading ? null : formatUSD(totalVolumeCents)}
        />
        <StatCard
          alert={(metrics?.failedTransactionsLast7Days ?? 0) > 0}
          icon={<AlertTriangle className="size-4" />}
          sub="Failed in last 7 days"
          title="Failed Transactions"
          value={isLoading ? null : (metrics?.failedTransactionsLast7Days ?? 0)}
        />
      </div>

      {/* KYC status breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">KYC Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {KYC_KEYS.map((key) => {
              const kycCount = metrics?.kycCounts[key] ?? 0;
              const pct =
                totalUsers > 0
                  ? Math.round((kycCount / totalUsers) * PERCENTAGE_MULTIPLIER)
                  : 0;
              return (
                <div
                  className="flex flex-col gap-1.5 rounded-lg border p-3"
                  key={key}
                >
                  {isLoading ? (
                    <>
                      <Skeleton className="h-6 w-10" />
                      <Skeleton className="h-3.5 w-16" />
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-xl tabular-nums">
                          {kycCount}
                        </span>
                        <Badge variant={KYC_VARIANTS[key]}>{pct}%</Badge>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        {KYC_LABELS[key]}
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Transaction type breakdown */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TxCard
          count={metrics?.transactionVolume.deposits.count}
          icon={<ArrowDownToLine className="size-4" />}
          isLoading={isLoading}
          label="Add Money"
          totalCents={metrics?.transactionVolume.deposits.totalAmountCents}
        />
        <TxCard
          count={metrics?.transactionVolume.withdrawals.count}
          icon={<ArrowUpFromLine className="size-4" />}
          isLoading={isLoading}
          label="Cash Out"
          totalCents={metrics?.transactionVolume.withdrawals.totalAmountCents}
        />
        <TxCard
          count={metrics?.transactionVolume.transfers.count}
          icon={<ArrowLeftRight className="size-4" />}
          isLoading={isLoading}
          label="Transfers"
          totalCents={metrics?.transactionVolume.transfers.totalAmountCents}
        />
      </div>

      {/* Recent audit activity */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Recent Audit Activity</CardTitle>
          <Button
            render={<Link href="/admin/audit-logs" />}
            size="sm"
            variant="ghost"
          >
            View all
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <AuditActivityContent
            isLoading={logsLoading}
            items={recentLogs?.items}
          />
        </CardContent>
      </Card>
    </div>
  );
}
