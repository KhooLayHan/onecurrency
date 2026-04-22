import { network } from "hardhat";
import { logger } from "../lib/logger";

const MAX_SUPPLY_TOKENS = 1_000_000n;
const TOKEN_DECIMALS = 18n;
const MAX_SUPPLY_WEI = MAX_SUPPLY_TOKENS * 10n ** TOKEN_DECIMALS;

async function main() {
  const { viem } = await network.connect();
  logger.info("Starting OneCurrency Deployment...");

  const [deployer] = await viem.getWalletClients();

  if (!deployer?.account.address) {
    throw new Error("No deployer wallet configured");
  }

  const deployerAddress = deployer.account.address;

  logger.info(`Deploying contracts with the account: ${deployerAddress}`);

  // Deploy the contract, passing the deployer as the initial Default Admin
  const token = await viem.deployContract("OneCurrency", [
    deployerAddress,
    MAX_SUPPLY_WEI,
  ]);

  const contractAddress = token.address;

  logger.info("OneCurrency deployed successfully!");
  logger.info(`Contract Address: ${contractAddress}`);
  logger.info(
    `View on Etherscan: https://sepolia.etherscan.io/address/${contractAddress}`
  );

  // NOTE: In the next milestone, you will copy this Contract Address and paste
  // it into your backend/frontend environment variables!
}

main().catch((error) => {
  logger.error("Deployment Failed:", error);
  process.exitCode = 1;
});
