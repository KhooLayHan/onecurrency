import { db } from "@/src/db";
import { networks } from "../schema/networks";

const HARDHAT_CHAIN_ID: number = 31_337;
const SEPOLIA_CHAIN_ID: number = 11_155_111;

export const seedNetworks = async (): Promise<void> => {
  await db
    .insert(networks)
    .values([
      {
        name: "Hardhat",
        chainId: BigInt(HARDHAT_CHAIN_ID),
        isTestnet: true,
        isActive: true,
      },
      {
        name: "Sepolia",
        chainId: BigInt(SEPOLIA_CHAIN_ID),
        isTestnet: true,
        isActive: true,
      },
      {
        name: "Ethereum",
        chainId: BigInt(1),
        isTestnet: false,
        isActive: false,
      },
      {
        name: "Optimism",
        chainId: BigInt(10),
        isTestnet: false,
        isActive: false,
      },
    ])
    .onConflictDoNothing({ target: networks.chainId });
};
