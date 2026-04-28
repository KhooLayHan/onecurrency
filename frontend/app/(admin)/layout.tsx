"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardList, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { orpcClient } from "@/lib/api";
import { useSession } from "@/lib/auth-client";
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

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
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
      router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!(rolesLoading || !rolesFetched || hasAccess)) {
      router.replace("/dashboard");
    }
  }, [sessionLoading, rolesLoading, rolesFetched, session, hasAccess, router, pathname]);

  if (sessionLoading || rolesLoading || !rolesFetched) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (!(session && hasAccess)) {
    return null;
  }

  const visibleNav = NAV_ITEMS.filter((item) =>
    item.roles.some((r) => roles?.includes(r))
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-56 shrink-0 border-r bg-muted/30 md:flex md:flex-col">
        <div className="border-b px-4 py-4">
          <p className="font-semibold text-sm">Compliance</p>
          <p className="text-muted-foreground text-xs">
            {isAdmin ? "Administrator" : "Compliance Officer"}
          </p>
        </div>
        <nav className="flex flex-col gap-1 p-2">
          {visibleNav.map((item) => (
            <Link
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-muted",
                pathname.startsWith(item.href)
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground"
              )}
              href={item.href}
              key={item.href}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-8 md:py-10">
          {children}
        </div>
      </main>

      <nav className="fixed right-0 bottom-0 left-0 z-50 flex border-t bg-background md:hidden">
        {visibleNav.map((item) => (
          <Link
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors",
              pathname.startsWith(item.href)
                ? "font-medium text-foreground"
                : "text-muted-foreground"
            )}
            href={item.href}
            key={item.href}
          >
            <item.icon className="size-5" />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
