import { Hono } from "hono";
import { StatusCodes } from "http-status-codes";
import { KYC_STATUS } from "../constants/kyc-status";
import { db } from "../db";
import type { KycSimulateResponse } from "../dto/user.dto";
import { handleApiError } from "../lib/api-response";
import { logger } from "../lib/logger";
import { withTransaction } from "../lib/transaction";
import { UserRepository } from "../repositories/user.repository";

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

  const result = await withTransaction(db, (tx) =>
    new UserRepository(tx).updateKycStatus(
      BigInt(session.userId),
      KYC_STATUS.VERIFIED
    )
  );

  if (result.isErr()) {
    logger.error({ err: result.error }, "Failed to simulate KYC");
    return handleApiError(c, result.error);
  }

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
});

export const usersRouter = app;
