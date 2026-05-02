import { faker } from "@faker-js/faker";
import { logger } from "@/src/lib/logger";
import { kycSubmissions } from "../schema/kyc-submissions";
import { batchInsert } from "./helpers";
import type { SeededRegularUser, SeededSpecialUser } from "./types";

const DOCUMENT_TYPES = ["passport", "drivers_license", "national_id"] as const;

const KYC_STATUS_PENDING = 2;
const KYC_STATUS_REJECTED = 4;
const KYC_STATUS_EXPIRED = 5;
const SEEDED_KYC_STATUSES = new Set([
  KYC_STATUS_PENDING,
  KYC_STATUS_REJECTED,
  KYC_STATUS_EXPIRED,
]);

const REJECTION_REASONS = [
  "Document image is blurry or unreadable",
  "Document has expired",
  "Name on document does not match account name",
  "Selfie does not match document photo",
  "Document type not accepted",
];

export async function seedKycSubmissions(
  allUsers: Array<SeededSpecialUser | SeededRegularUser>,
  complianceUserId: bigint
): Promise<void> {
  const eligible = allUsers.filter((u) =>
    SEEDED_KYC_STATUSES.has(u.kycStatusId)
  );

  const records: {
    userId: bigint;
    kycStatusId: number;
    fullName: string;
    dateOfBirth: string;
    nationality: string;
    documentType: string;
    documentFrontKey: string;
    documentBackKey?: string;
    selfieKey: string;
    rejectionReason?: string;
    reviewedByUserId?: bigint;
    reviewedAt?: Date;
    createdAt: Date;
  }[] = [];

  for (const user of eligible) {
    const documentType = faker.helpers.arrayElement(DOCUMENT_TYPES);
    const createdAt = faker.date.past({ years: 0.25 });
    const isRejected = user.kycStatusId === KYC_STATUS_REJECTED;
    const isReviewed = isRejected || user.kycStatusId === KYC_STATUS_EXPIRED;

    records.push({
      userId: user.id,
      kycStatusId: user.kycStatusId,
      fullName: user.name,
      dateOfBirth:
        faker.date
          .birthdate({ min: 18, max: 70, mode: "age" })
          .toISOString()
          .split("T")[0] ?? "",
      nationality: faker.location.countryCode("alpha-2"),
      documentType,
      documentFrontKey: `kyc/${user.id}/front_${faker.string.uuid()}.jpg`,
      documentBackKey:
        documentType !== "passport"
          ? `kyc/${user.id}/back_${faker.string.uuid()}.jpg`
          : undefined,
      selfieKey: `kyc/${user.id}/selfie_${faker.string.uuid()}.jpg`,
      rejectionReason: isRejected
        ? faker.helpers.arrayElement(REJECTION_REASONS)
        : undefined,
      reviewedByUserId: isReviewed ? complianceUserId : undefined,
      reviewedAt: isReviewed
        ? faker.date.between({ from: createdAt, to: new Date() })
        : undefined,
      createdAt,
    });
  }

  await batchInsert(kycSubmissions, records, { batchSize: 50 });
  logger.info(`Created ${records.length} KYC submissions`);
}
