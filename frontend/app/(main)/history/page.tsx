"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { transactionColumns } from "@/components/features/history/transaction-columns";
import { TransactionDataTable } from "@/components/features/history/transaction-data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { orpcClient } from "@/lib/api";

const HISTORY_QUERY_KEY = "deposit-history";

export default function HistoryPage() {
  const { data = [], isLoading } = useQuery({
    queryKey: [HISTORY_QUERY_KEY],
    queryFn: () => orpcClient.deposits.getHistory({}),
  });

  const addMoneyTransactions = useMemo(
    () => data.filter((t) => t.type === "add_money"),
    [data]
  );

  // TODO: Re-enable when withdrawals/cash-out backend is wired
  // const cashOutTransactions = useMemo(
  //   () => data.filter((t) => t.type === "cash_out"),
  //   [data]
  // );

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
          {/* TODO: Re-enable when cash-out backend is wired
          <TabsTrigger value="cash-out">Cash Out</TabsTrigger> */}
        </TabsList>

        <TabsContent className="mt-6" value="all">
          <TransactionDataTable
            columns={transactionColumns}
            data={data}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent className="mt-6" value="add-money">
          <TransactionDataTable
            columns={transactionColumns}
            data={addMoneyTransactions}
            isLoading={isLoading}
          />
        </TabsContent>

        {/* TODO: Re-enable when cash-out backend is wired
        <TabsContent className="mt-6" value="cash-out">
          <TransactionDataTable
            columns={transactionColumns}
            data={cashOutTransactions}
            isLoading={isLoading}
          />
        </TabsContent> */}
      </Tabs>
    </div>
  );
}
