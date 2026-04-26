import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MAX_SUPPLY_TOKENS = 1_000_000n;
const TOKEN_DECIMALS = 18n;
const MAX_SUPPLY_WEI = MAX_SUPPLY_TOKENS * 10n ** TOKEN_DECIMALS;

export default buildModule("OneCurrencyModule", (m) => {
  const defaultAdmin = m.getAccount(0);

  const token = m.contract("OneCurrency", [defaultAdmin, MAX_SUPPLY_WEI]);

  return { token };
});
