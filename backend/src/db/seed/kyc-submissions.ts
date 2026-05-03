import { faker } from "@faker-js/faker";
import { logger } from "@/src/lib/logger";
import { kycSubmissions } from "../schema/kyc-submissions";
import { batchInsert } from "./helpers";
import { getKycStatusIds } from "./lookup";
import type { SeededRegularUser, SeededSpecialUser } from "./types";

const DOCUMENT_TYPES = ["passport", "drivers_license", "national_id"] as const;

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
  // Resolve KYC status IDs from DB — no hardcoded values
  const kycIds = await getKycStatusIds();
  const seededKycStatuses = new Set([
    kycIds.pending,
    kycIds.rejected,
    kycIds.expired,
  ]);

  const eligible = allUsers.filter((u) => seededKycStatuses.has(u.kycStatusId));

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
    // Always after user creation — no submission can predate the account
    const createdAt = faker.date.between({
      from: user.createdAt,
      to: new Date(),
    });
    const isRejected = user.kycStatusId === kycIds.rejected;
    const isReviewed = isRejected || user.kycStatusId === kycIds.expired;

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
