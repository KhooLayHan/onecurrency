import { logger } from "@/lib/logger";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/types";
import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.connect();

describe("OneCurrency", () => {
  // Fixture to deploy the contract once and reuse the state
  async function deployTokenFixture() {
    const [admin, minter, firstUser, secondUser]: HardhatEthersSigner[] =
      await ethers.getSigners();

    const onecurrency = await ethers.getContractFactory("OneCurrency");
    const token = await onecurrency.deploy(admin?.address);

    if (token.MINTER_ROLE) {
      const MINTER_ROLE = await token.MINTER_ROLE();
      
      if (await token.grantRole(MINTER_ROLE, minter?.address))
      await token.grantRole(MINTER_ROLE, minter?.address);


    return {
      token,
      admin,
      minter,
      firstUser,
      secondUser,
      MINTER_ROLE,
    };
  }

  describe("deployment", () => {
    it("Should set the right default admin", async () => {
      const { token, admin } =
        await networkHelpers.loadFixture(deployTokenFixture);
      const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();

      expect(await token.hasRole(DEFAULT_ADMIN_ROLE, admin?.address)).to.be
        .true;
    });
  });

  describe("minting", () => {
    it("Should allow MINTER_ROLE to mint tokens", async () => {
      const { token, minter, firstUser } =
        await networkHelpers.loadFixture(deployTokenFixture);
      const mintAmount = ethers.parseUnits("100", 18); // 100 tokens

      await token.connect(minter).mint(firstUser?.address, mintAmount);
      expect(await token.balanceOf(firstUser.address)).to.equal(mintAmount);
    });

    it("Should revert if unauthorized account tries to mint", async () => {
      const { token, firstUser, MINTER_ROLE } =
        await networkHelpers.loadFixture(deployTokenFixture);
      const mintAmount = ethers.parseUnits("100", 18);

      await expect(
        token.connect(firstUser).mint(firstUser?.address, mintAmount)
      ).to.be.revertedWithCustomError(
        token,
        "AccessControlUnauthorizedAccount"
      );
    });
  });

  describe("Compliance (Blacklist)", () => {
    it("Should prevent blacklisted addresses from receiving tokens", async () => {
      const { token, admin, minter, firstUser } =
        await networkHelpers.loadFixture(deployTokenFixture);

      // Admin blacklist firstUser
      await token.connect(admin).blacklistAccount(firstUser?.address);
      expect(await token.isBlacklisted(firstUser?.address)).to.be.true;

      // Minter tries to mint to firstUser, should fail with custom error
      const mintAmount = ethers.parseUnits("50", 18);

      await expect(token.connect(minter).mint(firstUser?.address, mintAmount))
        .to.be.revertedWithCustomError(token, "BlacklistedAccount")
        .withArgs(firstUser?.address);
    });
  });
});
