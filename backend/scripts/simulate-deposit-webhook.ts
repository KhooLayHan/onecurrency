#!/usr/bin/env bun
/**
 * Dev-only: simulate a checkout.session.completed webhook for a PENDING deposit.
 *
 * Usage:
 *   bun run scripts/simulate-deposit-webhook.ts          # latest PENDING
 *   bun run scripts/simulate-deposit-webhook.ts <id>     # specific deposit ID
 */
import { createHmac } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import Stripe from "stripe";
import { TRANSACTION_STATUS } from "../src/constants/transaction-status";
import { db } from "../src/db";
import { deposits } from "../src/db/schema/deposits";
import { env } from "../src/env";

const WEBHOOK_URL =
  process.argv[3] ?? "http://localhost:3030/api/v1/deposits/webhook";

const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
  typescript: true,
});

async function main() {
  const depositIdArg = process.argv[2];
  let deposit: typeof deposits.$inferSelect | undefined;

  if (depositIdArg) {
    const [row] = await db
      .select()
      .from(deposits)
      .where(eq(deposits.id, BigInt(depositIdArg)))
      .limit(1);
    deposit = row;

    if (!deposit) {
      console.error(`No deposit found with id=${depositIdArg}`);
      process.exit(1);
    }
    if (deposit.statusId !== TRANSACTION_STATUS.PENDING) {
      console.error(
        `Deposit #${depositIdArg} is not PENDING (statusId=${deposit.statusId}). Nothing to simulate.`
      );
      process.exit(1);
    }
  } else {
    const [row] = await db
      .select()
      .from(deposits)
      .where(eq(deposits.statusId, TRANSACTION_STATUS.PENDING))
      .orderBy(desc(deposits.createdAt))
      .limit(1);
    deposit = row;

    if (!deposit) {
      console.error("No PENDING deposits found. Run a checkout first.");
      process.exit(1);
    }
  }

  console.log(
    `Found deposit #${deposit.id} — session: ${deposit.stripeSessionId}`
  );

  // Fetch the real Stripe session so metadata, amount_total, and payment_intent are genuine
  const session = await stripe.checkout.sessions.retrieve(
    deposit.stripeSessionId,
    { expand: ["payment_intent"] }
  );

  console.log(
    `Stripe session: status=${session.status}, payment_status=${session.payment_status}`
  );

  // Build the event payload using real session data
  const timestamp = Math.floor(Date.now() / 1000);
  const eventPayload = JSON.stringify({
    id: `evt_sim_${deposit.id}_${timestamp}`,
    object: "event",
    api_version: "2026-02-25.clover",
    created: timestamp,
    type: "checkout.session.completed",
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        ...session,
        status: "complete",
        payment_status: "paid",
      },
    },
  });

  // Sign it manually — generateTestHeaderString is sync-only and fails with SubtleCryptoProvider
  const sigTimestamp = String(timestamp);
  const signedPayload = `${sigTimestamp}.${eventPayload}`;
  const signature = createHmac("sha256", env.STRIPE_WEBHOOK_SECRET)
    .update(signedPayload)
    .digest("hex");
  const stripeSignature = `t=${sigTimestamp},v1=${signature}`;

  console.log(`Posting to ${WEBHOOK_URL}...`);

  // POST to the webhook endpoint — goes through the full real code path
  const response = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "stripe-signature": stripeSignature,
    },
    body: eventPayload,
  });

  const body = await response.text();

  if (response.ok) {
    console.log(`[${response.status}] Success: ${body}`);
  } else {
    console.error(`[${response.status}] Failed: ${body}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
