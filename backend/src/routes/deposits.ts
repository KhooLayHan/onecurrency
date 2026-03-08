import { Hono } from "hono";
import { mintTokens } from "../service/blockchain";
import { handleApiError } from "../lib/api-response";
import { success } from "zod";

const app = new Hono();

app.post('/test-mint', async (c) => {
    const { address, amountWei } = await c.req.json();
    const mintResult = await mintTokens(address, amountWei);

    if (mintResult.isErr()) {
        return handleApiError(c, mintResult.error);
    }

    return c.json({
        success: true, 
        data: {
            txHash: mintResult.value
        }
    });
}); 