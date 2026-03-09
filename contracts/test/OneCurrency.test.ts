import hre from "hardhat";
import { parseUnits } from "viem";
import { describe, expect, it } from "vitest";

const { viem, networkHelpers } = await hre.network.connect();
const DEFAULT_TOKEN_AMOUNT = 18; // 100 tokens

describe("OneCurrency", () => {
  // Fixture to deploy the contract once and reuse the state
  async function deployTokenFixture() {
    const publicClient = viem.getPublicClient();

    const [admin, minter, firstUser] = await viem.getWalletClients();

    const token = await viem.deployContract("OneCurrency", [
      admin?.account.address,
    ]);

    let MINTER_ROLE: unknown = "";
    if (token.read.MINTER_ROLE) {
      MINTER_ROLE = await token.read.MINTER_ROLE();
    }

    const writeMint = token.write.mint ?? undefined;
    const writeBlacklistAccount = token.write.blacklistAccount ?? undefined;
    const readHasRole = token.read.hasRole ?? undefined;
    const readBalanceOf = token.read.balanceOf ?? undefined;
    const readIsBlacklisted = token.read.isBlacklisted ?? undefined;

    if (token.write.grantRole) {
      await token.write.grantRole([MINTER_ROLE, minter?.account.address], {
        account: admin?.account,
      });
    }

    return {
      token,
      admin,
      minter,
      firstUser,
      MINTER_ROLE,
      publicClient,
      writeMint,
      writeBlacklistAccount,
      readHasRole,
      readBalanceOf,
      readIsBlacklisted,
    };
  }

  describe("Deployment", () => {
    it("Should set the right default admin", async () => {
      const { token, admin, readHasRole } =
        await networkHelpers.loadFixture(deployTokenFixture);

      let DEFAULT_ADMIN_ROLE: unknown = "";
      if (token.read.DEFAULT_ADMIN_ROLE) {
        DEFAULT_ADMIN_ROLE = await token.read.DEFAULT_ADMIN_ROLE();
      }

      if (readHasRole) {
        const isAdmin = await readHasRole([
          DEFAULT_ADMIN_ROLE,
          admin?.account.address,
        ]);
        expect(isAdmin).toBe(true);
      }
    });
  });

  describe("minting", () => {
    it("Should allow MINTER_ROLE to mint tokens", async () => {
      const { minter, firstUser, writeMint, readBalanceOf } =
        await networkHelpers.loadFixture(deployTokenFixture);
      const mintAmount = parseUnits("100", DEFAULT_TOKEN_AMOUNT); // 100 tokens

      if (writeMint) {
        await writeMint([firstUser?.account.address, mintAmount], {
          account: minter?.account,
        });
      }

      if (readBalanceOf) {
        const balance = await readBalanceOf([firstUser?.account.address]);
        expect(balance).toBe(mintAmount);
      }
    });

    it("Should revert if unauthorized account tries to mint", async () => {
      const { firstUser, writeMint } =
        await networkHelpers.loadFixture(deployTokenFixture);
      const mintAmount = parseUnits("100", DEFAULT_TOKEN_AMOUNT);

      if (writeMint) {
        await expect(
          writeMint([firstUser?.account.address, mintAmount], {
            account: firstUser?.account,
          })
        ).rejects.toThrowError("AccessControlUnauthorizedAccount");
      }
    });
  });

  describe("Compliance (Blacklist)", () => {
    it("Should prevent blacklisted addresses from receiving tokens", async () => {
      const {
        admin,
        minter,
        firstUser,
        writeMint,
        writeBlacklistAccount,
        readIsBlacklisted,
      } = await networkHelpers.loadFixture(deployTokenFixture);

      if (writeBlacklistAccount) {
        await writeBlacklistAccount([firstUser?.account.address], {
          account: admin?.account,
        });
      }

      // Admin blacklist firstUser
      if (readIsBlacklisted) {
        const isBlacklisted = await readIsBlacklisted([
          firstUser?.account.address,
        ]);
        expect(isBlacklisted).toBe(true);
      }

      // Minter tries to mint to firstUser, should fail with custom error
      const mintAmount = parseUnits("50", DEFAULT_TOKEN_AMOUNT);

      if (writeMint) {
        await expect(
          writeMint([firstUser?.account.address, mintAmount], {
            account: minter?.account,
          })
        ).rejects.toThrowError("BlacklistedAccount");
      }
    });
  });
});
