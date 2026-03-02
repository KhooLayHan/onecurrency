export const DEFAULT_BATCH_SIZE = 50;

export type SpecialUserConfig = {
  email: string;
  password: string;
  name: string;
  roleId: number;
  kycStatusId: number;
  depositLimitCents: bigint;
  emailVerified: boolean;
}

export type KycDistribution = {
  [statusId: number]: number;
}

export type RoleDistribution = {
  [roleId: number]: number;
}

export type DepositStatusDistribution = {
  completed: number;
  pending: number;
  failedNoTx: number;
  hybridFailed: number;
}

export type PerUserRange = {
  min: number;
  max: number;
}

export type UserSeedConfig = {
  count: number;
  kycDistribution: KycDistribution;
  dateRangeMonths: number;
  specialUsers: SpecialUserConfig[];
}

export type WalletSeedConfig = {
  perUser: PerUserRange;
}

export type SessionSeedConfig = {
  perUser: PerUserRange;
}

export type UserRoleSeedConfig = {
  roleDistribution: RoleDistribution;
}

export type DepositSeedConfig = {
  perUser: PerUserRange;
  statusDistribution: DepositStatusDistribution;
}

export type SeedConfig = {
  users: UserSeedConfig;
  wallets: WalletSeedConfig;
  sessions: SessionSeedConfig;
  userRoles: UserRoleSeedConfig;
  deposits: DepositSeedConfig;
}

export const defaultSeedConfig: SeedConfig = {
  users: {
    count: 100,
    kycDistribution: {
      1: 30, // None - New users
      2: 20, // Pending - In progress
      3: 40, // Verified - Approved
      4: 8, // Rejected - Failed KYC
      5: 2, // Expired - Expired verification
    },
    dateRangeMonths: 6,
    specialUsers: [
      {
        email: "admin@onecurrency.com",
        password: "Admin123!",
        name: "System Administrator",
        roleId: 2, // admin
        kycStatusId: 3, // verified
        depositLimitCents: 1_000_000n, // $10,000
        emailVerified: true,
      },
      {
        email: "user@onecurrency.com",
        password: "User123!",
        name: "Test User",
        roleId: 1, // user
        kycStatusId: 3, // verified
        depositLimitCents: 100_000n, // $1,000
        emailVerified: true,
      },
    ],
  },
  wallets: {
    perUser: {
      min: 1,
      max: 2,
    },
  },
  sessions: {
    perUser: {
      min: 1,
      max: 3,
    },
  },
  userRoles: {
    roleDistribution: {
      1: 95, // user
      2: 2, // admin
      3: 1, // compliance
      4: 2, // support
    },
  },
  deposits: {
    perUser: {
      min: 3,
      max: 5,
    },
    statusDistribution: {
      completed: 60, // Stripe success → Mint success
      pending: 20, // User in Stripe checkout
      failedNoTx: 15, // Card declined
      hybridFailed: 5, // Stripe success → Mint failed
    },
  },
};
