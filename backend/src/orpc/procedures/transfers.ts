import { ORPCError } from "@orpc/server";
import z from "zod";
import { db } from "@/src/db";
import { initiateTransferSchema } from "@/src/dto/transfer.dto";
import { logger } from "@/src/lib/logger";
import { TransferService } from "@/src/services/transfer.service";
import { base } from "../context";
import { mapToORPCError } from "../errors";
import { requireAuth } from "../middleware";

const transferService = new TransferService(db);

export const send = base
  .use(requireAuth)
  .route({
    method: "POST",
    path: "/transfers/send",
    summary: "Send money to another OneCurrency user",
    tags: ["Transfers"],
  })
  .input(initiateTransferSchema)
  .output(
    z.object({
      transferId: z.string(),
      recipientName: z.string(),
      status: z.literal("completed"),
    })
  )
  .handler(async ({ input, context }) => {
    const userId = context.session?.userId;
    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    logger.info(
      { userId, recipientEmail: input.recipientEmail },
      "Processing P2P transfer"
    );

    const result = await transferService.initiateTransfer(
      BigInt(userId),
      input
    );
    if (result.isErr()) {
      throw mapToORPCError(result.error);
    }
    return result.value;
  });

export const getHistory = base
  .use(requireAuth)
  .route({
    method: "GET",
    path: "/transfers/history",
    summary: "Get P2P transfer history for the authenticated user",
    tags: ["Transfers"],
  })
  .output(
    z.array(
      z.object({
        id: z.string(),
        publicId: z.string(),
        type: z.enum(["transfer_sent", "transfer_received"]),
        amountCents: z.number(),
        status: z.enum([
          "pending",
          "processing",
          "completed",
          "failed",
          "refunded",
        ]),
        counterpartyName: z.string(),
        note: z.string().nullable(),
        createdAt: z.date(),
      })
    )
  )
  .handler(async ({ context }) => {
    const userId = context.session?.userId;
    if (!userId) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "Authentication required",
      });
    }

    const result = await transferService.getHistory(BigInt(userId));
    if (result.isErr()) {
      logger.error(
        { error: result.error.toLog() },
        "Transfer history query failed"
      );
      throw mapToORPCError(result.error);
    }
    return result.value;
  });
