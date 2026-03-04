import { network } from "hardhat";

const { ethers } = await network.connect();

import { logger } from "../lib/logger";

async function main() {
  logger.info("Starting OneCurrency Deployment...");

  const [deployer] = await ethers.getSigners();
  logger.info(`Deploying contracts with the account: ${deployer?.address}`);

  // Deploy the contract, passing the deployer as the initial Default Admin
  const token = await ethers.deployContract("OneCurrency", [deployer?.address]);
  await token.waitForDeployment();

  const contractAddress = await token.getAddress();

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
