import { checkout, getHistory as getDepositHistory, testMint } from "./procedures/deposits";
import { getPrimaryWallet, simulateKyc, submitKyc } from "./procedures/users";
import { initiate, getHistory as getWithdrawalHistory } from "./procedures/withdrawals";

export const appRouter = {
  deposits: {
    testMint,
    checkout,
    getHistory: getDepositHistory,
  },
  users: {
    submitKyc,
    simulateKyc,
    getPrimaryWallet,
  },
  withdrawals: {
    initiate,
    getHistory: getWithdrawalHistory,
  },
};

export type AppRouter = typeof appRouter;
