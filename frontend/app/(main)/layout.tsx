"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppSidebar } from "@/components/shared/app-sidebar";
import { BottomTabs } from "@/components/shared/bottom-tabs";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { orpcClient } from "@/lib/api";
import { useSession } from "@/lib/auth-client";

const ADMIN_ROLES = ["admin", "compliance"];

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { data: session, isPending: sessionLoading } = useSession();
  const userId = session?.user?.id;

  const { data: roles, isFetched: rolesFetched } = useQuery({
    queryKey: ["my-roles", userId],
    queryFn: () => orpcClient.users.getMyRoles({}),
    enabled: !!userId,
  });

  useEffect(() => {
    if (sessionLoading || !rolesFetched) {
      return;
    }
    if (roles?.some((r) => ADMIN_ROLES.includes(r))) {
      router.replace("/admin/kyc");
    }
  }, [sessionLoading, rolesFetched, roles, router]);

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div className="flex-1 overflow-auto pb-20 sm:pb-0">
          <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-8 md:py-10">
            {children}
          </div>
        </div>
      </SidebarInset>
      <BottomTabs />
    </SidebarProvider>
  );
}
