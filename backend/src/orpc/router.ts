import { checkout, getHistory, testMint } from "./procedures/deposits";
import { getPrimaryWallet, simulateKyc, submitKyc } from "./procedures/users";

export const appRouter = {
  deposits: {
    testMint,
    checkout,
    getHistory,
  },
  users: {
    submitKyc,
    simulateKyc,
    getPrimaryWallet,
  },
};

export type AppRouter = typeof appRouter;
