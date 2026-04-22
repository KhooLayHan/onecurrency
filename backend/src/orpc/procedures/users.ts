import z from "zod";
import { db } from "@/src/db";
import { logger } from "@/src/lib/logger";
import { UserService } from "@/src/services/user.service";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requireAuth } from "../middleware";

const userService = new UserService(db);

export const simulateKyc = base
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/users/kyc/simulate",
    summary: "Simulate KYC identity verification",
    tags: ["Users"],
  })
  .output(z.object({ message: z.string() }))
  .handler(async ({ context }) => {
    const userId = context.session?.userId;
    const result = await userService.simulateKyc(BigInt(userId ?? 0));
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    logger.info({ userId }, "User successfully completed KYC simulation");
    return result.value;
  });
