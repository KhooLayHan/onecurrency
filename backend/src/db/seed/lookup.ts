import { db } from "@/src/db";
import type { KycStatusIds } from "./types";

// Query KYC status IDs from database by name
export async function getKycStatusIds(): Promise<KycStatusIds> {
  const statuses = await db._query.kycStatuses.findMany();

  const getId = (name: string): number => {
    const status = statuses.find((s) => s.name === name);
    if (!status) {
      throw new Error(`KYC status not found: ${name}`);
    }
    return status.id;
  };

  return {
    none: getId("None"),
    pending: getId("Pending"),
    verified: getId("Verified"),
    rejected: getId("Rejected"),
    expired: getId("Expired"),
  };
}

export type RoleIds = {
  user: number;
  admin: number;
  compliance: number;
  support: number;
};

// Query role IDs from database by name
export async function getRoleIds(): Promise<RoleIds> {
  const allRoles = await db._query.roles.findMany();

  const getId = (name: string): number => {
    const role = allRoles.find((r) => r.name === name);
    if (!role) {
      throw new Error(`Role not found: ${name}`);
    }
    return role.id;
  };

  return {
    user: getId("user"),
    admin: getId("admin"),
    compliance: getId("compliance"),
    support: getId("support"),
  };
}
