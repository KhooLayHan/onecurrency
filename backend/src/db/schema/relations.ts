import { defineRelations } from "drizzle-orm";
import { accounts } from "./accounts";
import { blockchainTransactions } from "./blockchain-transactions";
import { deposits } from "./deposits";
import { kycStatuses } from "./kyc-statuses";
import { networks } from "./networks";
import { roles } from "./roles";
import { sessions } from "./sessions";
import { transactionStatuses } from "./transaction-statuses";
import { transactionTypes } from "./transaction-types";
import { userRoles } from "./user-roles";
import { users } from "./users";
import { verifications } from "./verifications";
import { wallets } from "./wallets";

export const relations = defineRelations(
  {
    accounts,
    blockchainTransactions,
    deposits,
    kycStatuses,
    networks,
    roles,
    sessions,
    transactionStatuses,
    transactionTypes,
    userRoles,
    users,
    verifications,
    wallets,
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
    },
    sessions: {
      user: r.one.users({
        from: r.sessions.userId,
        to: r.users.id,
      }),
    },
    accounts: {
      account: r.one.users({
        from: r.accounts.userId,
        to: r.users.id,
      }),
    },
    kycStatuses: {
      users: r.many.users(),
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
    },
    networks: {
      wallets: r.many.wallets(),
      blockchainTransactions: r.many.blockchainTransactions(),
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
    transactionTypes: {
      blockchainTransactions: r.many.blockchainTransactions(),
    },
  })
);
