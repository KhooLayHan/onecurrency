import {
  addToBlacklist,
  approveKyc,
  getKycSubmission,
  listBlacklist,
  listKycSubmissions,
  rejectKyc,
  removeFromBlacklist,
  seizeTokens,
} from "./procedures/admin";
import {
  checkout,
  getHistory as getDepositHistory,
  testMint,
} from "./procedures/deposits";
import { getHistory as getTransferHistory, send } from "./procedures/transfers";
import {
  findRecipient,
  getKycUploadUrl,
  getLatestKycSubmission,
  getMyRoles,
  getPrimaryWallet,
  simulateKyc,
  submitKyc,
} from "./procedures/users";
import {
  getHistory as getWithdrawalHistory,
  initiate,
} from "./procedures/withdrawals";

export const appRouter = {
  deposits: { testMint, checkout, getHistory: getDepositHistory },
  users: {
    submitKyc,
    simulateKyc,
    getPrimaryWallet,
    findRecipient,
    getKycUploadUrl,
    getLatestKycSubmission,
    getMyRoles,
  },
  withdrawals: { initiate, getHistory: getWithdrawalHistory },
  transfers: { send, getHistory: getTransferHistory },
  admin: {
    kyc: {
      listSubmissions: listKycSubmissions,
      getSubmission: getKycSubmission,
      approve: approveKyc,
      reject: rejectKyc,
    },
    blacklist: {
      list: listBlacklist,
      add: addToBlacklist,
      remove: removeFromBlacklist,
      seize: seizeTokens,
    },
  },
};

export type AppRouter = typeof appRouter;
