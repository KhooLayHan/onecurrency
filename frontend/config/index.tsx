import { hardhat, sepolia } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { cookieStorage, createStorage, http } from "wagmi";
import { env } from "@/env";

export const projectId = env.NEXT_PUBLIC_WALLET_CONNECT_ID;

if (!projectId) {
  throw new Error("Project ID is not defined");
}

export const networks = [sepolia, hardhat];

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({
    storage: cookieStorage,
  }),
  ssr: true,
  projectId,
  networks,
  transports: {
    [hardhat.id]: http("http://127.0.0.1:8545"),
  },
});

export const appKitNetworks = networks;

export const config = wagmiAdapter.wagmiConfig;
