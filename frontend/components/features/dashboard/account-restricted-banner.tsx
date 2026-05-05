"use client";

import { Ban } from "lucide-react";

type AccountRestrictedBannerProps = {
  isBlacklisted: boolean;
  isSeized: boolean;
  isSuspended: boolean;
};

export function AccountRestrictedBanner({
  isBlacklisted,
  isSeized,
  isSuspended,
}: AccountRestrictedBannerProps) {
  if (!(isBlacklisted || isSeized || isSuspended)) {
    return null;
  }

  function getMessage(): { title: string; description: string } {
    if (isSuspended) {
      return {
        title: "Account suspended",
        description:
          "Your account has been suspended. Contact support for assistance.",
      };
    }
    if (isSeized) {
      return {
        title: "Account funds seized",
        description:
          "Funds in this account have been seized and no transactions can be made. Contact support for assistance.",
      };
    }
    return {
      title: "Account restricted",
      description:
        "This account has been flagged and restricted from making transactions. Contact support for assistance.",
    };
  }

  const { title, description } = getMessage();

  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 dark:border-destructive/20 dark:bg-destructive/5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/20">
        <Ban className="size-4 text-destructive" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-destructive text-sm">{title}</p>
        <p className="mt-0.5 text-destructive/80 text-xs">{description}</p>
      </div>
    </div>
  );
}
