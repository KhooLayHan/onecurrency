"use client";

import { useMemo } from "react";
import {
  type Transaction,
  transactionColumns,
} from "@/components/features/history/transaction-columns";
import { TransactionDataTable } from "@/components/features/history/transaction-data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data for demonstration - in production this would come from API
const MOCK_TRANSACTIONS: Transaction[] = [];

export default function HistoryPage() {
  // Filter transactions by type
  const addMoneyTransactions = useMemo(
    () => MOCK_TRANSACTIONS.filter((t) => t.type === "add_money"),
    []
  );

  const cashOutTransactions = useMemo(
    () => MOCK_TRANSACTIONS.filter((t) => t.type === "cash_out"),
    []
  );

  return (
    <div className="fade-in mx-auto flex w-full max-w-4xl animate-in flex-col gap-6 duration-300 ease-out">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">
          Transaction History
        </h1>
        <p className="mt-1 text-muted-foreground text-sm">
          View all your account activity and transaction details.
        </p>
      </div>

      <Tabs className="w-full" defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="add-money">Add Money</TabsTrigger>
          <TabsTrigger value="cash-out">Cash Out</TabsTrigger>
        </TabsList>

        <TabsContent className="mt-6" value="all">
          <TransactionDataTable
            columns={transactionColumns}
            data={MOCK_TRANSACTIONS}
          />
        </TabsContent>

        <TabsContent className="mt-6" value="add-money">
          <TransactionDataTable
            columns={transactionColumns}
            data={addMoneyTransactions}
          />
        </TabsContent>

        <TabsContent className="mt-6" value="cash-out">
          <TransactionDataTable
            columns={transactionColumns}
            data={cashOutTransactions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
