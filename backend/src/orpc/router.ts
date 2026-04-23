import { checkout, testMint } from "./procedures/deposits";
import { simulateKyc, submitKyc } from "./procedures/users";

export const appRouter = {
  deposits: {
    testMint,
    checkout,
  },
  users: {
    submitKyc,
    simulateKyc,
  },
};

export type AppRouter = typeof appRouter;
