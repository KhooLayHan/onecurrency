import type { Metadata } from "next";
import { headers } from "next/headers";
import { Providers } from "@/components/providers";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

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
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers cookies={cookies}>
          <TooltipProvider>{children}</TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
