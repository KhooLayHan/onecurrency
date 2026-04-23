/**
 * KYC Status IDs mirror the `kyc_statuses` table seeded in db/seed/kyc-statuses.ts
 * Values: None=1, Pending=2, Verified=3, Rejected=4, Expired=5
 */
export const KYC_STATUS = {
  NONE: 1,
  PENDING: 2,
  VERIFIED: 3,
  REJECTED: 4,
  EXPIRED: 5,
} as const;

export type KycStatusId = (typeof KYC_STATUS)[keyof typeof KYC_STATUS];
