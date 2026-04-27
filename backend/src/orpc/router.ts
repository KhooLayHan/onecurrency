import {
  checkout,
  getHistory as getDepositHistory,
  testMint,
} from "./procedures/deposits";
import { getHistory as getTransferHistory, send } from "./procedures/transfers";
import {
  findRecipient,
  getPrimaryWallet,
  simulateKyc,
  submitKyc,
} from "./procedures/users";
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
    findRecipient,
  },
  withdrawals: {
    initiate,
    getHistory: getWithdrawalHistory,
  },
  transfers: {
    send,
    getHistory: getTransferHistory,
  },
};

export type AppRouter = typeof appRouter;
