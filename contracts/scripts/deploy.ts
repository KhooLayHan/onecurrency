import { network } from "hardhat";
import { logger } from "../lib/logger";

// ─── Supply Cap ───────────────────────────────────────────────────────────────
// 1,000,000 ONE tokens (18 decimals)
const MAX_SUPPLY_TOKENS = 1_000_000n;
const MAX_SUPPLY_WEI = MAX_SUPPLY_TOKENS * 10n ** 18n;

async function main() {
  const networkName = network.name; // 'localhost' | 'sepolia'
  const { viem } = await network.connect();

  logger.info({ event: "deployment.started", network: networkName });

  const [deployer] = await viem.getWalletClients();
  const deployerAddress = deployer?.account.address;

  if (!deployerAddress) {
    throw new Error("No deployer wallet found — check your Hardhat config.");
  }

  logger.info({
    event: "deployment.deployer",
    address: deployerAddress,
    network: networkName,
  });

  // Deploy the contract
  const token = await viem.deployContract("OneCurrency", [
    deployerAddress,
    MAX_SUPPLY_WEI,
  ]);

  const contractAddress = token.address;

  logger.info({
    event: "deployment.success",
    contractAddress,
    network: networkName,
    maxSupplyTokens: MAX_SUPPLY_TOKENS.toString(),
  });

  // // ─── Save Deployment Artifact ───────────────────────────────────────────────
  // // This file is read by your backend .env setup and the seeding plan.
  // const deployment = {
  //   network: networkName,
  //   contractAddress,
  //   deployerAddress,
  //   deployedAt: new Date().toISOString(),
  //   maxSupplyTokens: MAX_SUPPLY_TOKENS.toString(),
  //   maxSupplyWei: MAX_SUPPLY_WEI.toString(),
  // };

  // mkdirSync("deployments", { recursive: true });
  // writeFileSync(
  //   `deployments/${networkName}.json`,
  //   JSON.stringify(deployment, null, 2)
  // );

  // ─── Etherscan Verification ─────────────────────────────────────────────────
  // Only runs on live networks — skipped for localhost/hardhat.
  if (networkName !== "localhost" && networkName !== "hardhat") {
    logger.info(
      "Waiting 30s for Etherscan to index the contract before verifying..."
    );
    // await new Promise((resolve) => setTimeout(resolve, 30_000));

    logger.info("Run the following command to verify on Etherscan:");
    logger.info(
      `pnpm hardhat verify --network ${networkName} ${contractAddress} ${deployerAddress} ${MAX_SUPPLY_WEI}`
    );

    logger.info(
      `View on Etherscan: https://sepolia.etherscan.io/address/${contractAddress}`
    );
  }
}

main().catch((error) => {
  logger.error({ event: "deployment.failed", error });
  process.exitCode = 1;
});