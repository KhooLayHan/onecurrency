"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { KYC_STATUS } from "@/common/constants/kyc";
import { Button } from "@/components/ui/button";

type KycBannerProps = {
  kycStatusId: number;
};

export function KycBanner({ kycStatusId }: KycBannerProps) {
  if (kycStatusId !== KYC_STATUS.NONE) {
    return null;
  }

  return (
    <div className="flex items-start gap-3 rounded-xl border border-highlight-200 bg-highlight-50 p-4 dark:border-highlight-800/40 dark:bg-highlight-900/20">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-highlight-100 dark:bg-highlight-800/40">
        <ShieldAlert className="size-4 text-highlight-600 dark:text-highlight-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-highlight-800 text-sm dark:text-highlight-200">
          Verify your identity
        </p>
        <p className="mt-0.5 text-highlight-700 text-xs dark:text-highlight-300">
          Complete identity verification to unlock Add Money and Transfers.
        </p>
      </div>
      <Button
        className="shrink-0"
        render={<Link href="/profile" />}
        size="sm"
        variant="outline"
      >
        Start
      </Button>
    </div>
  );
}
