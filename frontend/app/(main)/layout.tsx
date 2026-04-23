"use client";

import { AppSidebar } from "@/components/shared/app-sidebar";
import { BottomTabs } from "@/components/shared/bottom-tabs";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <main className="flex-1 overflow-auto pb-20 sm:pb-0">
          <div className="container mx-auto max-w-7xl px-4 py-6 sm:px-8 md:py-10">
            {children}
          </div>
        </main>
      </SidebarInset>
      <BottomTabs />
    </SidebarProvider>
  );
}
