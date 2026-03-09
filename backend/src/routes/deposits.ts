import { Hono } from "hono";
import { handleApiError } from "../lib/api-response";
import { mintTokens } from "../services/blockchain";

const app = new Hono();

app.post("/test-mint", async (c) => {
  const { address, amountWei } = await c.req.json();
  const mintResult = await mintTokens(address, amountWei);

  if (mintResult.isErr()) {
    return handleApiError(c, mintResult.error);
  }

  return c.json({
    success: true,
    data: {
      txHash: mintResult.value,
    },
  });
});

export const depositsRouter = app;
