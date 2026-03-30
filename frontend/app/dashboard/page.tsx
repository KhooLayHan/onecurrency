"use client";

import { Wallet } from "lucide-react";
import { useConnection } from "wagmi";
import { BalanceCard } from "@/components/features/dashboard/balance-card";

export default function DashboardPage() {
  const { isConnected } = useConnection();

  return (
    <div className="fade-in flex animate-in flex-col gap-6 duration-300 ease-out">
      {/* Page Header */}
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Dashboard</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          Manage your global funds securely.
        </p>
      </div>

      {/* Conditional Rendering based on Web3 State */}
      {isConnected ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
          {/* Main Column */}
          <div className="flex flex-col gap-6 md:col-span-7 lg:col-span-8">
            <BalanceCard />

            {/* Transaction History Placeholder */}
            <div className="pt-4">
              <h2 className="mb-4 font-semibold text-lg">Recent Activity</h2>
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/50 p-12 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
                  <Wallet className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="font-medium text-base">No activity yet</h3>
                <p className="mt-1 text-muted-foreground text-sm">
                  When you add money to your account, your transactions will
                  appear here.
                </p>
              </div>
            </div>
          </div>

          {/* Right Sidebar (Desktop only) */}
          <div className="hidden md:col-span-5 md:block lg:col-span-4">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <h3 className="mb-2 font-semibold">Account Status</h3>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-success-500" />
                <span className="font-medium text-sm">Network Operational</span>
              </div>
              <p className="mt-1 ml-4.5 text-muted-foreground text-xs">
                Your account is secure and active
              </p>
            </div>
          </div>
        </div>
      ) : (
        /* Empty State: Not Logged In */
        <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Wallet className="h-10 w-10 text-primary" />
          </div>
          <h2 className="mb-2 font-bold text-2xl">Welcome to OneCurrency</h2>
          <p className="mx-auto mb-8 max-w-md text-muted-foreground">
            Connect your account or login via email to access your secure global
            balance.
          </p>
          <appkit-button />
        </div>
      )}
    </div>
  );
}
