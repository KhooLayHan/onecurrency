export const DEFAULT_BATCH_SIZE = 50;

export type SpecialUserConfig = {
  email: string;
  password: string;
  name: string;
  roleName: "user" | "admin" | "compliance" | "support";
  kycStatusName: "none" | "pending" | "verified" | "rejected" | "expired";
  depositLimitCents: bigint;
  emailVerified: boolean;
};

export type KycDistribution = {
  [statusId: number]: number;
};

export type RoleDistribution = {
  [roleId: number]: number;
};

export type DepositStatusDistribution = {
  completed: number;
  pending: number;
  failedNoTx: number;
  hybridFailed: number;
};

export type WithdrawalStatusDistribution = {
  completed: number;
  pending: number;
  failed: number;
};

export type PerUserRange = {
  min: number;
  max: number;
};

export type UserSeedConfig = {
  count: number;
  kycDistribution: KycDistribution;
  dateRangeMonths: number;
  specialUsers: SpecialUserConfig[];
};

export type WalletSeedConfig = {
  perUser: PerUserRange;
};

export type SessionSeedConfig = {
  perUser: PerUserRange;
};

export type UserRoleSeedConfig = {
  roleDistribution: RoleDistribution;
};

export type DepositSeedConfig = {
  perUser: PerUserRange;
  statusDistribution: DepositStatusDistribution;
};

export type WithdrawalSeedConfig = {
  perUser: PerUserRange;
  statusDistribution: WithdrawalStatusDistribution;
};

export type TransferSeedConfig = {
  perPair: PerUserRange;
  statusDistribution: WithdrawalStatusDistribution;
};

// KYC submissions are seeded one per user with non-verified KYC status
// No additional config needed — derived from user kycStatusId
export type KycSubmissionSeedConfig = Record<string, never>;

export type SeedConfig = {
  users: UserSeedConfig;
  wallets: WalletSeedConfig;
  sessions: SessionSeedConfig;
  userRoles: UserRoleSeedConfig;
  deposits: DepositSeedConfig;
  withdrawals: WithdrawalSeedConfig;
  transfers: TransferSeedConfig;
  kycSubmissions: KycSubmissionSeedConfig;
};

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
        roleName: "admin",
        kycStatusName: "verified",
        depositLimitCents: 1_000_000n, // $10,000
        emailVerified: true,
      },
      {
        email: "compliance@onecurrency.com",
        password: "Compliance123!",
        name: "Compliance Officer",
        roleName: "compliance",
        kycStatusName: "verified",
        depositLimitCents: 500_000n, // $5,000
        emailVerified: true,
      },
      {
        email: "support@onecurrency.com",
        password: "Support123!",
        name: "Support Staff",
        roleName: "support",
        kycStatusName: "verified",
        depositLimitCents: 100_000n, // $1,000
        emailVerified: true,
      },
      {
        email: "deposit@onecurrency.com",
        password: "Deposit123!",
        name: "Demo Deposit User",
        roleName: "user",
        kycStatusName: "verified",
        depositLimitCents: 500_000n, // $5,000
        emailVerified: true,
      },
      {
        email: "withdraw@onecurrency.com",
        password: "Withdraw123!",
        name: "Demo Withdraw User",
        roleName: "user",
        kycStatusName: "verified",
        depositLimitCents: 500_000n, // $5,000
        emailVerified: true,
      },
      {
        email: "transfer@onecurrency.com",
        password: "Transfer123!",
        name: "Demo Transfer User",
        roleName: "user",
        kycStatusName: "verified",
        depositLimitCents: 500_000n, // $5,000
        emailVerified: true,
      },
      {
        email: "kyc@onecurrency.com",
        password: "Kyc123!",
        name: "Demo KYC User",
        roleName: "user",
        kycStatusName: "pending",
        depositLimitCents: 50_000n, // $500
        emailVerified: true,
      },
      {
        email: "blacklist@onecurrency.com",
        password: "Blacklist123!",
        name: "Demo Blacklist User",
        roleName: "user",
        kycStatusName: "verified",
        depositLimitCents: 100_000n, // $1,000
        emailVerified: true,
      },
      {
        email: "user@onecurrency.com",
        password: "User123!",
        name: "Test User",
        roleName: "user",
        kycStatusName: "verified",
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
      1: 100, // user only for regular users
    },
  },
  deposits: {
    perUser: {
      min: 3,
      max: 5,
    },
    statusDistribution: {
      completed: 60, // Stripe success -> Mint success
      pending: 20, // User in Stripe checkout
      failedNoTx: 15, // Card declined
      hybridFailed: 5, // Stripe success -> Mint failed
    },
  },
  withdrawals: {
    perUser: {
      min: 1,
      max: 3,
    },
    statusDistribution: {
      completed: 70,
      pending: 20,
      failed: 10,
    },
  },
  transfers: {
    perPair: {
      min: 1,
      max: 3,
    },
    statusDistribution: {
      completed: 75,
      pending: 15,
      failed: 10,
    },
  },
  kycSubmissions: {},
};
