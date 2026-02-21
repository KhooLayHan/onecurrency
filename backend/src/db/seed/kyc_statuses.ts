import { db } from "@/src/db";
import { kycStatuses } from "../schema/kyc-statuses";

export const seedKycStatuses = async () => {
  await db.insert(kycStatuses).values([
    { name: "None", description: "KYC not started" },
    {
      name: "Pending",
      description: "KYC documents submitted, awaiting review",
    },
    { name: "Verified", description: "KYC approved" },
    { name: "Rejected", description: "KYC rejected" },
    { name: "Expired", description: "KYC verification expired" },
  ]);
};
