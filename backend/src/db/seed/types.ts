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
};

// Regular user return type
export type SeededRegularUser = {
  id: bigint;
  email: string;
  name: string;
  kycStatusId: number;
};

// Batch insert options
export type BatchInsertOptions = {
  batchSize?: number;
};

export type BatchInsertReturningOptions<T> = BatchInsertOptions & {
  returning: { [K in keyof T]: any };
};
