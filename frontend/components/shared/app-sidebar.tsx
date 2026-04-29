"use client";

import { ArrowLeftRight, Home, LogOut, Receipt, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", Icon: Home },
  {
    id: "transfer",
    label: "Transfer",
    href: "/transfer",
    Icon: ArrowLeftRight,
  },
  { id: "history", label: "History", href: "/history", Icon: Receipt },
  { id: "profile", label: "Profile", href: "/profile", Icon: User },
] as const;

type SidebarFooterContentProps = {
  isPending: boolean;
  session: ReturnType<typeof useSession>["data"];
  onSignOut: () => void;
};

function SidebarFooterContent({
  isPending,
  session,
  onSignOut,
}: SidebarFooterContentProps) {
  if (isPending) {
    return (
      <div className="flex items-center gap-3 px-2 py-1">
        <Skeleton className="size-8 rounded-full" />
        <div className="flex flex-col gap-1 group-data-[collapsible=icon]:hidden">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex flex-col gap-2">
        {/* Persistent wallet connect/manage button — hidden in icon-collapsed mode */}
        <div className="group-data-[collapsible=icon]:hidden">
          <appkit-button />
        </div>
        <div className="flex items-center gap-3 px-2 py-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
            <User className="size-4 text-muted-foreground" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="truncate font-medium text-sm">
              {session.user.name}
            </span>
            <span className="truncate text-muted-foreground text-xs">
              {session.user.email}
            </span>
          </div>
        </div>
        <Button
          className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center"
          onClick={onSignOut}
          size="sm"
          variant="ghost"
        >
          <LogOut className="size-4" />
          <span className="group-data-[collapsible=icon]:hidden">Sign out</span>
        </Button>
      </div>
    );
  }

  return (
    <Button
      className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center"
      render={<Link href="/login" />}
      size="sm"
      variant="outline"
    >
      <User className="size-4" />
      <span className="group-data-[collapsible=icon]:hidden">Sign in</span>
    </Button>
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, isPending } = useSession();

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

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      {/* Header: Brand Logo */}
      <SidebarHeader className="p-4">
        <Link className="flex items-center gap-2" href="/dashboard">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary">
            <span className="font-bold text-lg text-primary-foreground">1</span>
          </div>
          <span className="font-bold text-xl tracking-tight group-data-[collapsible=icon]:hidden">
            OneCurrency
          </span>
        </Link>
      </SidebarHeader>

      {/* Content: Navigation */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV_ITEMS.map(({ id, label, href, Icon }) => {
                const isActive = pathname === href;
                return (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      isActive={isActive}
                      render={<Link href={href} />}
                      tooltip={label}
                    >
                      <Icon
                        className={cn(
                          "size-4",
                          isActive ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer: User Info + Sign Out */}
      <SidebarFooter>
        <Separator className="mb-2" />
        <SidebarFooterContent
          isPending={isPending}
          onSignOut={handleSignOut}
          session={session}
        />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
