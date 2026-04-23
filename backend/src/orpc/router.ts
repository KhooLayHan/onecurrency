import { checkout, testMint } from "./procedures/deposits";
import { getPrimaryWallet, simulateKyc, submitKyc } from "./procedures/users";

export const appRouter = {
  deposits: {
    testMint,
    checkout,
  },
  users: {
    submitKyc,
    simulateKyc,
    getPrimaryWallet,
  },
};

export type AppRouter = typeof appRouter;
