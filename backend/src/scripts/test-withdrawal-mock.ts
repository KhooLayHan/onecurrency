/**
 * Dev-only script: directly test the withdrawal flow with Stripe mock.
 * Bypasses HTTP/auth and invokes WithdrawalService directly.
 *
 * Usage:
 *   bun run src/scripts/test-withdrawal-mock.ts <userId> <amountCents>
 */
import { db, pool } from "../db";
import { WithdrawalService } from "../services/withdrawal.service";

async function run() {
  const { eq } = await import("drizzle-orm");
  const { users } = await import("../db/schema/users");
  const withdrawUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, process.argv[2] ?? "withdraw@onecurrency.com"))
    .limit(1)
    .then((rows) => rows[0] ?? null);
  if (!withdrawUser) {
    console.error("User not found");
    await pool.end();
    process.exit(1);
  }
  const userId = withdrawUser.id;
  const amountCents = Number(process.argv[3] ?? "2000");

  console.log(
    `Testing withdrawal for user ${userId}, amount ${amountCents} cents`
  );

  const service = new WithdrawalService(db);
  const result = await service.initiateWithdrawal(userId, {
    amountCents,
    bankAccountHolderName: "Test User",
    bankAccountHolderType: "individual",
    bankRoutingNumber: "021000021",
    bankAccountNumber: "000123456",
  });

  if (result.isOk()) {
    console.log("SUCCESS:", result.value);
  } else {
    console.error("FAILED:", result.error.toLog());
    process.exitCode = 1;
  }

  await pool.end();
}

run().catch(async (err) => {
  console.error("Unhandled error:", err);
  await pool.end();
  process.exit(1);
});
