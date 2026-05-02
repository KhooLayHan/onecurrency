// KYC Status ID mapping
export type KycStatusIds = {
  none: number;
  pending: number;
  verified: number;
  rejected: number;
  expired: number;
};

// Special user return type
export type SeededSpecialUser = {
  id: bigint;
  email: string;
  name: string;
  roleId: number;
  kycStatusId: number;
  createdAt: Date;
};

// Regular user return type
export type SeededRegularUser = {
  id: bigint;
  email: string;
  name: string;
  kycStatusId: number;
  createdAt: Date;
};

export type SeededWallet = {
  id: bigint;
  userId: bigint;
  address: string;
  isPrimary: boolean;
};

// Grouped by user ID
export type SeededWalletsByUser = Map<bigint, SeededWallet[]>;

export type SeededDeposit = {
  id: bigint;
  userId: bigint;
  walletId: bigint;
  statusId: number;
};

export type SeededDepositsByUser = Map<bigint, SeededDeposit[]>;

export type SeededBlockchainTx = {
  id: bigint;
  networkId: number;
  txHash: string;
};

export type SeededWithdrawal = {
  id: bigint;
  userId: bigint;
  walletId: bigint;
};

export type SeededTransfer = {
  id: bigint;
  senderUserId: bigint;
  receiverUserId: bigint;
};

// Batch insert options
export type BatchInsertOptions = {
  batchSize?: number;
};

export type BatchInsertReturningOptions<T> = BatchInsertOptions & {
  returning: { [K in keyof T]: unknown };
};
