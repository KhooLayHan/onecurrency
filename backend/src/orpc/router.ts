import { checkout, testMint } from "./procedures/deposits";
import { simulateKyc } from "./procedures/users";

export const appRouter = {
  deposits: {
    testMint,
    checkout,
  },
  users: {
    simulateKyc,
  },
};

export type AppRouter = typeof appRouter;
