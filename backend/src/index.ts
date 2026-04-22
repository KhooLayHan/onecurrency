import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { onError } from "@orpc/server";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { openAPIRouteHandler } from "hono-openapi";
import { auth } from "./auth";
import { env } from "./env";
import { logger as pinoLogger } from "./lib/logger";
import type { ORPCContext } from "./orpc/context";
import { appRouter } from "./orpc/router";
import { depositsWebhookRouter } from "./routes/deposits/deposits";

type SessionVariables = {
  session: {
    userId: number;
  } | null;
};

const app = new Hono<{ Variables: SessionVariables }>();

app.use(
  "*",
  logger()
  // logger({
  //   pino: logger,
  //   http: {
  //     reqId: () => Bun.randomUUIDv7(),
  //   },
  // })
);

app.use(
  "/api/*",
  cors({
    origin: env.CORS_ORIGIN,
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
  })
);

app.get("/", (c) => c.json({ message: "Hello Hono!", status: "ok" }));

const v1 = new Hono<{ Variables: SessionVariables }>();

v1.get("health", (c) =>
  c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  })
);

// Inject better-auth session into Hono context for all v1 routes
// Unsure why got CORS errors
v1.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (session?.user) {
    c.set("session", { userId: Number(session.user.id) });
  }

  await next();
});

// better-auth sign-in / sign-up / session routes
v1.on(["POST", "GET"], "/auth/**", (c) => auth.handler(c.req.raw));

// Stripe webhook — must stay as a raw Hono route: Stripe signature verification
// requires the unparsed request body, which oRPC's handler would consume first.
v1.route("/deposits", depositsWebhookRouter);

// oRPC OpenAPIHandler — serves checkout, test-mint, and kyc/simulate.
// Proxies the raw request so oRPC reuses Hono's already-parsed body buffer
// instead of double-reading it (avoids "body already used" errors).
const openAPIHandler = new OpenAPIHandler(appRouter, {
  interceptors: [
    onError((error) => {
      pinoLogger.error(error, "oRPC unhandled error");
    }),
  ],
});

const BODY_PARSER_METHODS = new Set([
  "arrayBuffer",
  "blob",
  "formData",
  "json",
  "text",
] as const);

type BodyParserMethod = typeof BODY_PARSER_METHODS extends Set<infer T>
  ? T
  : never;

v1.use("*", async (c, next) => {
  const request = new Proxy(c.req.raw, {
    get(target, prop) {
      if (BODY_PARSER_METHODS.has(prop as BodyParserMethod)) {
        return () => c.req[prop as BodyParserMethod]();
      }
      return Reflect.get(target, prop, target);
    },
  });

  const context: ORPCContext = { session: c.get("session") ?? null };

  const { matched, response } = await openAPIHandler.handle(request, {
    prefix: "/api/v1",
    context,
  });

  if (matched) {
    return c.newResponse(response.body, response);
  }

  await next();
});

app.route("/api/v1", v1);

// OpenAPI Spec Endpoint
app.get(
  "/api/v1/openapi.json",
  openAPIRouteHandler(v1, {
    documentation: {
      openapi: "3.0.0",
      info: {
        title: "OneCurrency API",
        version: "1.0.0",
        description: "API documentation for OneCurrency e-wallet application",
      },
      servers: [
        {
          url: `http://localhost:${env.API_PORT}/api/v1`,
          description: "Local development server",
        },
      ],
      tags: [
        { name: "Health", description: "Health check endpoints" },
        { name: "Auth", description: "Authentication endpoints" },
        { name: "Deposits", description: "Deposit and payment processing" },
        { name: "Users", description: "User management and KYC" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "JWT token from better-auth session",
          },
        },
      },
      security: [
        {
          bearerAuth: [],
        },
      ],
    },
  })
);

// Scalar API Reference UI
app.get(
  "/api/v1/docs",
  Scalar({
    url: "/api/v1/openapi.json",
  })
);

export default {
  port: env.API_PORT,
  fetch: app.fetch,
};
