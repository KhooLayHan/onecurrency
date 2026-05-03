/**
 * Application router.
 *
 * Assembles all oRPC procedures into the `appRouter` object that the
 * `RPCHandler` in `index.ts` serves. Each key in the router maps directly
 * to the namespace the frontend RPCLink uses to call procedures.
 *
 * Procedures are organised by domain:
 *   deposits      — add-money / Stripe checkout flows
 *   users         — wallet info, recipient lookup, role query
 *   users.kyc     — KYC submission, upload URLs, status queries
 *   withdrawals   — cash-out initiation and history
 *   transfers     — P2P send and history
 *   admin.kyc     — KYC review (list, approve, reject)
 *   admin.blacklist — on-chain blacklist management
 *   admin.transactions — admin transaction list and detail
 *   admin.users   — admin user management
 */

import { listAuditLogs } from "./procedures/admin-audit-logs";
import {
  addToBlacklist,
  listBlacklist,
  removeFromBlacklist,
  seizeTokens,
} from "./procedures/admin-blacklist";
import {
  approveKyc,
  getKycSubmission,
  listKycSubmissions,
  rejectKyc,
} from "./procedures/admin-kyc";
import { getAdminMetricsSummary } from "./procedures/admin-metrics";
import {
  getAdminTransaction,
  listAdminTransactions,
} from "./procedures/admin-transactions";
import {
  getAdminUser,
  listAdminUsers,
  restoreUser,
  suspendUser,
  updateUserDepositLimit,
} from "./procedures/admin-users";
import {
  checkout,
  getHistory as getDepositHistory,
  testMint,
} from "./procedures/deposits";
import { getHistory as getTransferHistory, send } from "./procedures/transfers";
import {
  findRecipient,
  getMyRoles,
  getPrimaryWallet,
} from "./procedures/users";
import {
  getKycUploadUrl,
  getLatestKycSubmission,
  simulateKyc,
  submitKyc,
} from "./procedures/users-kyc";
import {
  getHistory as getWithdrawalHistory,
  initiate,
} from "./procedures/withdrawals";

export const appRouter = {
  deposits: { testMint, checkout, getHistory: getDepositHistory },
  users: {
    getPrimaryWallet,
    findRecipient,
    getMyRoles,
    submitKyc,
    simulateKyc,
    getKycUploadUrl,
    getLatestKycSubmission,
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
    transactions: {
      list: listAdminTransactions,
      get: getAdminTransaction,
    },
    users: {
      list: listAdminUsers,
      get: getAdminUser,
      updateDepositLimit: updateUserDepositLimit,
      suspend: suspendUser,
      restore: restoreUser,
    },
    metrics: { getSummary: getAdminMetricsSummary },
    auditLogs: { list: listAuditLogs },
  },
};

export type AppRouter = typeof appRouter;
