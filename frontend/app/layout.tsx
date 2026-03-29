import type { Metadata } from "next";
import "./globals.css";
import { headers } from "next/headers"; // added
import { Providers } from "@/components/providers";
import { BottomTabs } from "@/components/shared/bottom-tabs";
import { TopNav } from "@/components/shared/top-nav";

export const metadata: Metadata = {
  title: "OneCurrency",
  description: "A Hybrid Financial Bridge for Cross-Border Transactions",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersObj = await headers();
  const cookies = headersObj.get("cookie");

  return (
    <html lang="en">
      <body className="min-h-screen bg-background pb-20 font-sans antialiased sm:pb-0">
        <Providers cookies={cookies}>
          <TopNav />

          <header className="border-border/40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
            <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
              <div className="font-bold text-primary text-xl">OneCurrency</div>

              <appkit-button />
            </div>
          </header>

          {/* Main Content Area */}
          {/* Container restricts max width on massive monitors */}
          <main className="container mx-auto max-w-7xl px-4 py-6 sm:px-8 md:py-10">
            {children}
          </main>
        </Providers>
        <BottomTabs />
      </body>
    </html>
  );
}
