import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MAX_SUPPLY_TOKENS = 1_000_000n;
const TOKEN_DECIMALS = 18n;
const MULTIPLIER_10 = 10n;

const MAX_SUPPLY_WEI = MAX_SUPPLY_TOKENS * MULTIPLIER_10 ** TOKEN_DECIMALS;

export default buildModule("OneCurrencyModule", (m) => {
  const defaultAdmin = m.getAccount(0);

  const token = m.contract("OneCurrency", [defaultAdmin, MAX_SUPPLY_WEI]);

  return { token };
});
