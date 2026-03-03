import { ethers } from "hardhat";

// const ethers = require("hardhat");

// import hre from "hardhat";
// const { ethers } = hre;

async function main() {
  console.log("🚀 Starting OneCurrency Deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy the contract, passing the deployer as the initial Default Admin
  const token = await ethers.deployContract("OneCurrency", [deployer.address]);
  await token.waitForDeployment();

  const contractAddress = await token.getAddress();
  
  console.log("✅ OneCurrency deployed successfully!");
  console.log("📜 Contract Address:", contractAddress);
  console.log("🔗 View on Etherscan: https://sepolia.etherscan.io/address/" + contractAddress);
  
  // NOTE: In the next milestone, you will copy this Contract Address and paste 
  // it into your backend/frontend environment variables!
}

main().catch((error) => {
  console.error("❌ Deployment Failed:", error);
  process.exitCode = 1;
});