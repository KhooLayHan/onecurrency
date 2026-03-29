import type { Metadata } from "next";
import "./globals.css";
import { headers } from "next/headers"; // added
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: "OneCurrency",
  description: "A Hybrid Financial Bridge",
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
          {/* Top Navigation Bar */}
          <header className="border-border/40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
            <div className="container flex h-14 max-w-screen-2xl items-center justify-between">
              <div className="font-bold text-primary text-xl">OneCurrency</div>

              {/* THE APPKIT CONNECT BUTTON */}
              <appkit-button />
            </div>
          </header>

          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
