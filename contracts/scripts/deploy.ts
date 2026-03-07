import { network } from "hardhat";
import { logger } from "../lib/logger";

async function main() {
  const { viem } = await network.connect();

  logger.info("Starting OneCurrency Deployment...");

  const [deployer] = await viem.getWalletClients();
  logger.info(
    `Deploying contracts with the account: ${deployer?.account.address}`
  );

  // Deploy the contract, passing the deployer as the initial Default Admin
  const token = await viem.deployContract("OneCurrency", [
    deployer?.account.address,
  ]);
  // await token.waitForDeployment();

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
