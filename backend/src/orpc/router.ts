import {
  checkout,
  getHistory as getDepositHistory,
  testMint,
} from "./procedures/deposits";
import { getPrimaryWallet, simulateKyc, submitKyc } from "./procedures/users";
import {
  getHistory as getWithdrawalHistory,
  initiate,
} from "./procedures/withdrawals";

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
