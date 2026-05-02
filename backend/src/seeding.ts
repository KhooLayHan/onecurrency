import { sql } from "drizzle-orm";
import { db, pool } from "./db";
import { seedBlacklistedAddresses } from "./db/seed/blacklisted-addresses";
import { seedDeposits } from "./db/seed/deposits";
import { seedKycStatuses } from "./db/seed/kyc-statuses";
import { seedKycSubmissions } from "./db/seed/kyc-submissions";
import { seedNetworks } from "./db/seed/networks";
import { seedRoles } from "./db/seed/roles";
import { seedSessions } from "./db/seed/sessions";
import { seedTransactionStatuses } from "./db/seed/transaction-statuses";
import { seedTransactionTypes } from "./db/seed/transaction-types";
import { seedTransfers } from "./db/seed/transfers";
import type { SeededSpecialUser } from "./db/seed/types";
import { seedRegularUserRoles } from "./db/seed/user-roles";
import { seedRegularUsers, seedSpecialUsers } from "./db/seed/users";
import { seedWallets } from "./db/seed/wallets";
import { seedWithdrawals } from "./db/seed/withdrawals";
import { env } from "./env";
import { logger } from "./lib/logger";

if (env.NODE_ENV === "production") {
  logger.info("Seeding not allowed in production");
  process.exit(0);
}

if (env.DB_SEEDING !== true) {
  logger.info("DB_SEEDING must be set to true");
  process.exit(0);
}

const reset = async (): Promise<void> => {
  const tables = await db.execute<{ table_name: string }>(
    sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE'
      and table_name not like '__drizzle%'
    `
  );

  for (const { table_name } of tables.rows) {
    await db.execute(
      sql`truncate table ${sql.identifier(table_name)} restart identity cascade`
    );
  }
};

await reset();

// --- Lookup tables (no dependencies) ---
await seedKycStatuses();
await seedTransactionStatuses();
await seedTransactionTypes();
await seedNetworks();
await seedRoles();

// --- Users ---
const specialUsers: SeededSpecialUser[] = await seedSpecialUsers();
const regularUsers = await seedRegularUsers();

// Resolve named special user IDs for downstream seeders
const findSpecial = (email: string) => {
  const u = specialUsers.find((s) => s.email === email);
  if (!u) {
    throw new Error(`Special user not found: ${email}`);
  }
  return u;
};

const adminUser = findSpecial("admin@onecurrency.com");
const complianceUser = findSpecial("compliance@onecurrency.com");
const withdrawUser = findSpecial("withdraw@onecurrency.com");
const transferUser = findSpecial("transfer@onecurrency.com");
const blacklistUser = findSpecial("blacklist@onecurrency.com");

// --- Roles for regular users ---
await seedRegularUserRoles(regularUsers, adminUser.id);

// --- KYC submissions (before wallets — no dependency on wallets) ---
const allUsers = [...specialUsers, ...regularUsers];
await seedKycSubmissions(allUsers, complianceUser.id);

// --- Wallets (all users) ---
const walletsByUser = await seedWallets([...specialUsers, ...regularUsers]);

// --- Sessions (all users) ---
await seedSessions(allUsers);

// --- Deposits (verified users with wallets only) ---
const network = await db._query.networks.findFirst({
  where: (n, { eq }) => eq(n.name, "Sepolia"),
});
if (!network) {
  throw new Error("Sepolia network not found");
}

const allUsersWithKyc = [
  ...specialUsers.map((u) => ({ ...u, kycStatusId: u.kycStatusId })),
  ...regularUsers,
];

await seedDeposits(walletsByUser, allUsersWithKyc, network.id);

// --- Withdrawals ---
await seedWithdrawals(
  walletsByUser,
  allUsersWithKyc,
  network.id,
  withdrawUser.id
);

// --- Transfers ---
await seedTransfers(
  walletsByUser,
  allUsersWithKyc,
  network.id,
  transferUser.id
);

// --- Blacklisted addresses (compliance table — seeded last among compliance) ---
await seedBlacklistedAddresses(
  walletsByUser,
  blacklistUser.id,
  complianceUser.id,
  network.id
);

await pool.end();
