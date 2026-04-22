"use client";

import { hardhat, sepolia } from "@reown/appkit/networks";
import { createAppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { type Config, cookieToInitialState, WagmiProvider } from "wagmi";
import { projectId, wagmiAdapter } from "@/config";

if (!projectId) {
  throw new Error("Project ID is not defined");
}

const metadata = {
  name: "OneCurrency",
  description: "A Hybrid Fiat-to-Crypto Bridge",
  url: "http://localhost:3000",
  icons: ["https://avatars.githubusercontent.com/u/37784886"],
};

// Create the modal
createAppKit({
  adapters: [wagmiAdapter],
  networks: [sepolia, hardhat],
  projectId,
  metadata,
  features: {
    email: true,
    socials: ["google", "apple"],
    emailShowWallets: true,
    analytics: true, // Optional - defaults to your Cloud configuration
  },
  themeMode: "light",
});

export function Providers({
  children,
  cookies,
}: {
  children: ReactNode;
  cookies: string | null;
}) {
  const [queryClient] = useState(() => new QueryClient());

  const initialState = cookieToInitialState(
    wagmiAdapter.wagmiConfig as Config,
    cookies
  );

  return (
    <WagmiProvider
      config={wagmiAdapter.wagmiConfig as Config}
      initialState={initialState}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
