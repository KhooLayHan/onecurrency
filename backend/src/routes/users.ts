import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { StatusCodes } from "http-status-codes";
import { InternalError } from "@/common/errors/infrastructure";
import { KYC_STATUS } from "../constants/kyc-status";
import { db } from "../db";
import { users } from "../db/schema/users";
import type { KycSimulateResponse } from "../dto/user.dto";
import { handleApiError } from "../lib/api-response";
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
    await db
      .update(users)
      .set({
        kycStatusId: KYC_STATUS.VERIFIED,
        updatedAt: new Date(),
      })
      .where(eq(users.id, BigInt(session.userId)));

    logger.info(
      { userId: session.userId },
      "User successfully completed KYC simulation"
    );

    const response: KycSimulateResponse = {
      message: "Identity verified successfully.",
    };

    return c.json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to simulate KYC");
    return handleApiError(
      c,
      new InternalError("An unexpected error occurred during KYC simulation.", {
        cause: error,
      })
    );
  }
});

export const usersRouter = app;
