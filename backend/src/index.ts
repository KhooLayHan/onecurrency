/**
 * Application entry point.
 *
 * Wires together the Hono app, middleware, and route handlers:
 *
 * - CORS is applied once via a shared config factory and mounted on `/api/*`.
 * - The better-auth session is injected into Hono context for all v1 routes
 *   so downstream middleware and oRPC procedures can read it without hitting
 *   the auth layer again.
 * - Stripe webhook routes bypass oRPC because Stripe signature verification
 *   requires the raw, unconsumed request body.
 * - All other API calls are handled by the oRPC `RPCHandler`.
 */

import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { lt } from "drizzle-orm";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./auth";
import { db } from "./db";
import { sessions } from "./db/schema/sessions";
import { env } from "./env";
import { logger as pinoLogger } from "./lib/logger";
import type { ORPCContext } from "./orpc/context";
import { appRouter } from "./orpc/router";
import { depositsWebhookRouter } from "./routes/deposits/deposits";

type SessionVariables = {
  session: {
    userId: string;
  } | null;
};

/**
 * Builds the shared CORS middleware options.
 *
 * Allows requests from the configured production and local origins.
 * Falls back to `LOCAL_CORS_ORIGIN` for any unlisted origin so the app
 * remains usable in development without broad wildcard permissiveness.
 */
function buildCorsOptions() {
  return cors({
    origin: (origin) => {
      const allowedOrigins = [
        env.PROD_CORS_ORIGIN,
        env.PROD_SUB_CORS_ORIGIN,
        env.LOCAL_CORS_ORIGIN,
      ];
      if (origin && allowedOrigins.includes(origin)) {
        return origin;
      }
      return env.LOCAL_CORS_ORIGIN;
    },
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "X-Custom-Header",
      "Upgrade-Insecure-Requests",
    ],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length", "X-Kuma-Revision"],
    maxAge: 600,
    credentials: true,
  });
}

const app = new Hono<{ Variables: SessionVariables }>();

app.use("*", logger());

// Apply CORS to all /api/* routes using the shared config
app.use("/api/*", buildCorsOptions());

app.get("/", (c) => c.json({ message: "Hello Hono!", status: "ok" }));

const v1 = new Hono<{ Variables: SessionVariables }>();

// Apply CORS to all v1 routes as well (v1 is mounted under /api/v1)
v1.use("*", buildCorsOptions());

// Stripe webhook — must stay as a raw Hono route: Stripe signature verification
// requires the unparsed request body, which oRPC's handler would consume first.
v1.route("/deposits", depositsWebhookRouter);

v1.get("health", (c) =>
  c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  })
);

// Inject the better-auth session into Hono context for all v1 routes so
// oRPC procedures can access it via `context.session` without re-fetching.
v1.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (session?.user) {
    c.set("session", { userId: session.user.id });
  }
  await next();
});

// better-auth sign-in / sign-up / session routes
v1.on(["POST", "GET"], "/auth/**", (c) => auth.handler(c.req.raw));

/**
 * oRPC RPCHandler — serves all procedures via the RPC protocol.
 *
 * RPCLink on the frontend sends `{ json, meta }` envelopes, which this
 * handler understands natively. Validation errors are logged in detail to
 * aid debugging without leaking them to the client.
 */
const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      pinoLogger.error(error, "oRPC unhandled error");
      if (
        error instanceof Error &&
        error.cause &&
        typeof error.cause === "object"
      ) {
        const cause = error.cause;
        if ("flatten" in cause || "issues" in cause) {
          pinoLogger.error(
            { validationError: cause },
            "Input validation failed - detailed error"
          );
        }
      }
    }),
  ],
});

// Mount the oRPC handler on all unmatched v1 routes
v1.use("*", async (c, next) => {
  const context: ORPCContext = { session: c.get("session") ?? null };

  const { matched, response } = await rpcHandler.handle(c.req.raw, {
    prefix: "/api/v1",
    context,
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

app.route("/api/v1", v1);

// biome-ignore lint/style/noMagicNumbers: <>
const SESSION_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
setInterval(async () => {
  try {
    await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
    pinoLogger.info("Expired sessions cleaned up");
  } catch (err) {
    pinoLogger.error({ err }, "Failed to clean up expired sessions");
  }
}, SESSION_CLEANUP_INTERVAL_MS);

export default {
  port: env.API_PORT,
  fetch: app.fetch,
};
