"use client";

import { ArrowLeftRight, Home, Receipt, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TAB_BAR_HEIGHT_PX = 64;
const TAB_ICON_SIZE_PX = 24;

const TABS = [
  { id: "home", label: "Home", href: "/dashboard", Icon: Home },
  {
    id: "transfer",
    label: "Transfer",
    href: "/transfer",
    Icon: ArrowLeftRight,
  },
  { id: "history", label: "History", href: "/history", Icon: Receipt },
  { id: "profile", label: "Profile", href: "/profile", Icon: User },
] as const;

export function BottomTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="fixed right-0 bottom-0 left-0 z-50 border-border border-t bg-background/80 pb-safe backdrop-blur-xl sm:hidden"
      style={{ height: TAB_BAR_HEIGHT_PX }}
    >
      <div className="mx-auto flex h-full max-w-md items-center justify-around px-2">
        {TABS.map(({ id, label, href, Icon }) => {
          const isActive = pathname === href;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-w-16 flex-col items-center justify-center gap-1 transition-colors duration-200",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              href={href}
              key={id}
            >
              <Icon
                aria-hidden="true"
                className={cn(isActive ? "stroke-[2.5]" : "stroke-[1.5]")}
                fill={isActive ? "currentColor" : "none"}
                size={TAB_ICON_SIZE_PX}
              />
              <span
                className={cn(
                  "font-medium text-[10px]",
                  isActive ? "font-bold" : ""
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
