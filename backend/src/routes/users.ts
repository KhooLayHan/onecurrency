import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { StatusCodes } from "http-status-codes";
import { db } from "../db";
import { kycStatuses } from "../db/schema/kyc-statuses";
import { users } from "../db/schema/users";
import { logger } from "../lib/logger";

const app = new Hono<{ Variables: { session: { userId: number } } }>();

// SIMULATED KYC ENDPOINT
app.post("/kyc/simulate", async (c) => {
  const session = c.get("session");

  if (!session?.userId) {
    return c.json(
      { success: false, error: "Unauthorized" },
      StatusCodes.UNAUTHORIZED
    );
  }

  try {
    const result = db
      .select({ id: kycStatuses.id })
      .from(kycStatuses)
      .where(eq(kycStatuses.id, 1));

    const { id } = result;

    // TODO: Trigger an Onfido/Stripe Identity flow.
    await db
      .update(users)
      .set({
        kycStatusId: 3,
        updatedAt: new Date(),
      })
      .where(eq(users.id, BigInt(session.userId)));

    logger.info(
      { userId: session.userId },
      "User successfully completed KYC simulation"
    );

    return c.json({
      success: true,
      message: "Identity verified successfully.",
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to simulate KYC");
    return c.json(
      { success: false, error: "INTERNAL_SERVER_ERROR" },
      StatusCodes.INTERNAL_SERVER_ERROR
    );
  }
});

export const usersRouter = app;
