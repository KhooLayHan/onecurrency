import { db } from "@/src/db";
import { roles } from "../schema/roles";

export const seedRoles = async (): Promise<void> => {
  await db.insert(roles).values([
    {
      name: "user",
      description: "Standard user",
      permissions: [
        "user:read:own",
        "user:update:own",
        "user:delete:own",
        "deposit:create",
        "deposit:read:own",
        "deposit:list:own",
        "withdrawal:create",
        "withdrawal:read:own",
        "withdrawal:list:own",
        "wallet:create",
        "wallet:read:own",
        "wallet:update:own",
        "wallet:delete:own",
        "wallet:list:own",
        "kyc:submit:own",
        "kyc:read:own",
        "audit:read:own",
        "transaction:read:own",
        "transaction:list:own",
      ],
    },
    {
      name: "admin",
      description: "Administrator",
      permissions: ["*"],
    },
    {
      name: "compliance",
      description: "Compliance officer",
      permissions: [
        "user:read",
        "user:list",
        "kyc:read",
        "kyc:verify",
        "kyc:reject",
        "blacklist:read",
        "blacklist:manage",
        "audit:read",
        "deposit:read",
        "deposit:list",
        "withdrawal:read",
        "withdrawal:list",
        "transaction:read",
        "transaction:list",
      ],
    },
    {
      name: "support",
      description: "Support staff",
      permissions: [
        "user:read",
        "user:list",
        "deposit:read",
        "deposit:list",
        "withdrawal:read",
        "withdrawal:list",
        "wallet:read",
        "kyc:read",
        "audit:read:own",
        "transaction:read",
        "transaction:list",
        "webhook:read",
      ],
    },
  ]);
  // .onConflictDoNothing({ target: roles.name });
};
