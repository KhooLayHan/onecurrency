"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  LogOut,
  Menu,
  ShieldAlert,
  ShieldCheck,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { orpcClient } from "@/lib/api";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const ADMIN_ROLES = ["admin", "compliance"];

const NAV_ITEMS = [
  {
    label: "KYC Submissions",
    href: "/admin/kyc",
    icon: ClipboardList,
    roles: ["admin", "compliance"],
  },
  {
    label: "Blacklist Manager",
    href: "/admin/blacklist",
    icon: ShieldAlert,
    roles: ["admin"],
  },
];

const PAGE_TITLES: Record<string, string> = {
  "/admin/kyc": "KYC Submissions",
  "/admin/blacklist": "Blacklist Manager",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }
  for (const [prefix, title] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(prefix)) {
      return title;
    }
  }
  return "Admin";
}

type SidebarUserFooterProps = {
  session: ReturnType<typeof useSession>["data"];
  isPending: boolean;
  onSignOut: () => void;
};

function SidebarUserFooter({
  session,
  isPending,
  onSignOut,
}: SidebarUserFooterProps) {
  if (isPending) {
    return (
      <div className="flex items-center gap-3 px-3 py-2">
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const initials = session.user.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3 rounded-lg px-3 py-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary font-semibold text-primary-foreground text-xs">
          {initials || <User className="size-3.5" />}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium text-sm leading-tight">
            {session.user.name}
          </span>
          <span className="truncate text-muted-foreground text-xs leading-tight">
            {session.user.email}
          </span>
        </div>
      </div>
      <Button
        className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
        onClick={onSignOut}
        size="sm"
        variant="ghost"
      >
        <LogOut className="size-4" />
        Sign out
      </Button>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;

  const {
    data: roles,
    isLoading: rolesLoading,
    isFetched: rolesFetched,
  } = useQuery({
    queryKey: ["my-roles", userId],
    queryFn: () => orpcClient.users.getMyRoles({}),
    enabled: !!userId,
  });

  const hasAccess = roles?.some((r) => ADMIN_ROLES.includes(r)) ?? false;
  const isAdmin = roles?.includes("admin") ?? false;

  useEffect(() => {
    if (sessionLoading) {
      return;
    }
    if (!session) {
      router.replace(`/login?callbackUrl=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!(rolesLoading || !rolesFetched || hasAccess)) {
      router.replace("/dashboard");
    }
  }, [
    sessionLoading,
    rolesLoading,
    rolesFetched,
    session,
    hasAccess,
    router,
    pathname,
  ]);

  // Close mobile sidebar on route change
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname triggers close intentionally
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname]);

  const handleSignOut = async () => {
    try {
      const result = await signOut();
      if (result.error) {
        toast.error("Failed to sign out. Please try again.");
        return;
      }
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Failed to sign out. Please try again.");
    }
  };

  if (sessionLoading || rolesLoading || !rolesFetched) {
    return (
      <div className="flex min-h-screen">
        {/* Sidebar skeleton */}
        <aside className="hidden w-56 shrink-0 border-r bg-muted/30 md:flex md:flex-col">
          <div className="border-b px-4 py-4">
            <div className="flex items-center gap-2">
              <Skeleton className="size-8 rounded-lg" />
              <Skeleton className="h-5 w-28" />
            </div>
          </div>
          <div className="flex flex-col gap-1 p-2">
            {[1, 2].map((i) => (
              <Skeleton className="h-9 w-full rounded-md" key={i} />
            ))}
          </div>
        </aside>
        {/* Content skeleton */}
        <div className="flex flex-1 flex-col">
          <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4">
            <Skeleton className="h-5 w-36" />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <Skeleton className="h-8 w-48" />
          </div>
        </div>
      </div>
    );
  }

  if (!(session && hasAccess)) {
    return null;
  }

  const visibleNav = NAV_ITEMS.filter((item) =>
    item.roles.some((r) => roles?.includes(r))
  );

  const pageTitle = getPageTitle(pathname);

  const sidebarContent = (
    <>
      {/* Brand header */}
      <div className="border-b px-4 py-4">
        <Link className="flex items-center gap-2.5" href="/admin/kyc">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <span className="font-bold text-lg text-primary-foreground leading-none">
              1
            </span>
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm leading-tight">OneCurrency</span>
            <span className="text-muted-foreground text-xs leading-tight">
              {isAdmin ? "Admin Portal" : "Compliance Portal"}
            </span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {visibleNav.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              className={cn(
                "relative flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 font-semibold text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              href={item.href}
              key={item.href}
            >
              {isActive && (
                <span className="-translate-y-1/2 absolute top-1/2 left-0 h-5 w-0.5 rounded-full bg-primary" />
              )}
              <item.icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="border-t p-2">
        <SidebarUserFooter
          isPending={sessionLoading}
          onSignOut={handleSignOut}
          session={session}
        />
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 border-r bg-muted/30 md:flex md:flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileSidebarOpen(false)}
          />
          {/* Drawer */}
          <aside className="absolute top-0 bottom-0 left-0 flex w-64 flex-col border-r bg-background shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky top header bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/60">
          {/* Mobile menu toggle */}
          <Button
            aria-label="Open navigation menu"
            className="-ml-1 shrink-0 md:hidden"
            onClick={() => setMobileSidebarOpen(true)}
            size="sm"
            variant="ghost"
          >
            <Menu className="size-5" />
          </Button>

          {/* Mobile brand */}
          <Link className="flex items-center gap-2 md:hidden" href="/admin/kyc">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary">
              <span className="font-bold text-primary-foreground text-sm leading-none">
                1
              </span>
            </div>
          </Link>

          {/* Page title + badge */}
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="hidden size-4 shrink-0 text-muted-foreground md:block" />
            <h1 className="truncate font-semibold text-foreground text-sm">
              {pageTitle}
            </h1>
          </div>

          <div className="flex-1" />

          {/* Role badge — desktop only */}
          <span className="hidden items-center rounded-full border bg-muted/50 px-2.5 py-0.5 font-medium text-muted-foreground text-xs md:inline-flex">
            {isAdmin ? "Administrator" : "Compliance Officer"}
          </span>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0">
          <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-8 md:py-10">
            {children}
          </div>
        </main>

        {/* Mobile bottom nav */}
        <nav className="fixed right-0 bottom-0 left-0 z-50 flex border-t bg-background md:hidden">
          {visibleNav.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                className={cn(
                  "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors",
                  isActive
                    ? "font-semibold text-primary"
                    : "text-muted-foreground"
                )}
                href={item.href}
                key={item.href}
              >
                <item.icon
                  className={cn(
                    "size-5",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
          {/* Mobile logout in bottom nav */}
          <button
            className="flex flex-1 flex-col items-center gap-1 py-3 text-muted-foreground text-xs transition-colors hover:text-foreground"
            onClick={handleSignOut}
            type="button"
          >
            <LogOut className="size-5" />
            Sign out
          </button>
        </nav>
      </div>
    </div>
  );
}
