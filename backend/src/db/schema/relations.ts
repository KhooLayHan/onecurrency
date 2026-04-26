import { defineRelations } from "drizzle-orm";
import { accounts } from "./accounts";
import { auditLogs } from "./audit-logs";
import { blacklistedAddresses } from "./blacklisted-addresses";
import { blockchainTransactions } from "./blockchain-transactions";
import { deposits } from "./deposits";
import { kycStatuses } from "./kyc-statuses";
import { kycSubmissions } from "./kyc-submissions";
import { networks } from "./networks";
import { roles } from "./roles";
import { sessions } from "./sessions";
import { transactionStatuses } from "./transaction-statuses";
import { transactionTypes } from "./transaction-types";
import { userRoles } from "./user-roles";
import { users } from "./users";
import { verifications } from "./verifications";
import { wallets } from "./wallets";
import { webhookEvents } from "./webhook-events";
import { withdrawals } from "./withdrawals";

export const relations = defineRelations(
  {
    accounts,
    auditLogs,
    blacklistedAddresses,
    blockchainTransactions,
    deposits,
    kycStatuses,
    kycSubmissions,
    networks,
    roles,
    sessions,
    transactionStatuses,
    transactionTypes,
    userRoles,
    users,
    verifications,
    wallets,
    webhookEvents,
    withdrawals,
  },
  (r) => ({
    users: {
      kycStatus: r.one.kycStatuses({
        from: r.users.kycStatusId,
        to: r.kycStatuses.id,
      }),
      sessions: r.many.sessions(),
      accounts: r.many.accounts(),
      userRoles: r.many.userRoles(),
      wallets: r.many.wallets(),
      deposits: r.many.deposits(),
      auditLogs: r.many.auditLogs(),
      blacklistedAddressesAdded: r.many.blacklistedAddresses(),
      kycSubmissions: r.many.kycSubmissions(),
      withdrawals: r.many.withdrawals(),
    },
    sessions: {
      user: r.one.users({
        from: r.sessions.userId,
        to: r.users.id,
      }),
      auditLogs: r.many.auditLogs(),
    },
    accounts: {
      account: r.one.users({
        from: r.accounts.userId,
        to: r.users.id,
      }),
    },
    kycStatuses: {
      users: r.many.users(),
      kycSubmissions: r.many.kycSubmissions(),
    },
    roles: {
      userRoles: r.many.userRoles(),
    },
    userRoles: {
      user: r.one.users({
        from: r.userRoles.userId,
        to: r.users.id,
      }),
      role: r.one.roles({
        from: r.userRoles.roleId,
        to: r.roles.id,
      }),
    },
    wallets: {
      user: r.one.users({
        from: r.wallets.userId,
        to: r.users.id,
      }),
      network: r.one.networks({
        from: r.wallets.networkId,
        to: r.networks.id,
      }),
      deposits: r.many.deposits(),
      withdrawals: r.many.withdrawals(),
    },
    networks: {
      wallets: r.many.wallets(),
      blockchainTransactions: r.many.blockchainTransactions(),
      blacklistedAddresses: r.many.blacklistedAddresses(),
    },
    deposits: {
      user: r.one.users({
        from: r.deposits.userId,
        to: r.users.id,
      }),
      wallet: r.one.wallets({
        from: r.deposits.walletId,
        to: r.wallets.id,
      }),
      status: r.one.transactionStatuses({
        from: r.deposits.statusId,
        to: r.transactionStatuses.id,
      }),
      blockchainTransaction: r.one.blockchainTransactions({
        from: r.deposits.blockchainTxId,
        to: r.blockchainTransactions.id,
      }),
    },
    transactionStatuses: {
      deposits: r.many.deposits(),
      withdrawals: r.many.withdrawals(),
    },
    blockchainTransactions: {
      network: r.one.networks({
        from: r.blockchainTransactions.networkId,
        to: r.networks.id,
      }),
      type: r.one.transactionTypes({
        from: r.blockchainTransactions.transactionTypeId,
        to: r.transactionTypes.id,
      }),
    },
    withdrawals: {
      user: r.one.users({
        from: r.withdrawals.userId,
        to: r.users.id,
      }),
      wallet: r.one.wallets({
        from: r.withdrawals.walletId,
        to: r.wallets.id,
      }),
      status: r.one.transactionStatuses({
        from: r.withdrawals.statusId,
        to: r.transactionStatuses.id,
      }),
      blockchainTransaction: r.one.blockchainTransactions({
        from: r.withdrawals.blockchainTxId,
        to: r.blockchainTransactions.id,
      }),
    },
    transactionTypes: {
      blockchainTransactions: r.many.blockchainTransactions(),
    },
    auditLogs: {
      user: r.one.users({
        from: r.auditLogs.userId,
        to: r.users.id,
      }),
      session: r.one.sessions({
        from: r.auditLogs.sessionId,
        to: r.sessions.id,
      }),
    },
    blacklistedAddresses: {
      network: r.one.networks({
        from: r.blacklistedAddresses.networkId,
        to: r.networks.id,
      }),
      addedBy: r.one.users({
        from: r.blacklistedAddresses.addedByUserId,
        to: r.users.id,
      }),
    },
    kycSubmissions: {
      user: r.one.users({
        from: r.kycSubmissions.userId,
        to: r.users.id,
      }),
      kycStatus: r.one.kycStatuses({
        from: r.kycSubmissions.kycStatusId,
        to: r.kycStatuses.id,
      }),
    },
  })
);
