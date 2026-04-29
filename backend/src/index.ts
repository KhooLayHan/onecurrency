// import { OpenAPIHandler } from "@orpc/openapi/fetch";
// import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
// import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./auth";
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

v1.use(
  "*",
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

// Inject better-auth session into Hono context for all v1 routes
// Unsure why got CORS errors
v1.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (session?.user) {
    c.set("session", { userId: session.user.id });
  }

  await next();
});

// better-auth sign-in / sign-up / session routes
v1.on(["POST", "GET"], "/auth/**", (c) => auth.handler(c.req.raw));

// oRPC RPCHandler — serves all procedures via RPC protocol (matches RPCLink on frontend).
// Previously used OpenAPIHandler but switched due to protocol mismatch:
// RPCLink sends { json, meta } envelope which OpenAPIHandler doesn't understand.
const rpcHandler = new RPCHandler(appRouter, {
  interceptors: [
    onError((error) => {
      pinoLogger.error(error, "oRPC unhandled error");
      // Log validation errors in detail for debugging
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

// const openAPIHandler = new OpenAPIHandler(appRouter, {
//   plugins: [
//     new OpenAPIReferencePlugin({
//       specPath: "/openapi.json",
//       specGenerateOptions: {
//         info: {
//           title: "OneCurrency API",
//           version: "1.0.0",
//           description: "API documentation for OneCurrency e-wallet application",
//         },
//         servers: [
//           {
//             url: `http://localhost:${env.API_PORT}/api/v1`,
//             description: "Local development server",
//           },
//         ],
//       },
//     }),
//   ],
//   interceptors: [
//     onError((error) => {
//       pinoLogger.error(error, "oRPC unhandled error");
//       if (error.cause && typeof error.cause === "object") {
//         const cause = error.cause;
//         if ("flatten" in cause || "issues" in cause) {
//           pinoLogger.error(
//             { validationError: cause },
//             "Input validation failed - detailed error"
//           );
//         }
//       }
//     }),
//   ],
// });

// RPCHandler route — no body proxy needed, RPCHandler reads the raw request directly
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

// Body proxy + OpenAPIHandler route (commented out — kept for reference/rollback)
// const BODY_PARSER_METHODS = new Set([
//   "arrayBuffer",
//   "blob",
//   "formData",
//   "json",
//   "text",
// ] as const);
//
// type BodyParserMethod = typeof BODY_PARSER_METHODS extends Set<infer T>
//   ? T
//   : never;
//
// v1.use("*", async (c, next) => {
//   const request = new Proxy(c.req.raw, {
//     get(target, prop) {
//       if (BODY_PARSER_METHODS.has(prop as BodyParserMethod)) {
//         return () => c.req[prop as BodyParserMethod]();
//       }
//       const value = Reflect.get(target, prop, target);
//       // Bind functions to preserve this-context (e.g., request.clone())
//       return typeof value === "function" ? value.bind(target) : value;
//     },
//   });
//
//   const context: ORPCContext = { session: c.get("session") ?? null };
//
//   const { matched, response } = await openAPIHandler.handle(request, {
//     prefix: "/api/v1",
//     context,
//   });
//
//   if (matched) {
//     return c.newResponse(response.body, response);
//   }
//
//   await next();
// });

app.route("/api/v1", v1);

// Scalar API Reference UI (served by oRPC OpenAPIReferencePlugin at /api/v1/openapi.json)
// app.get("/api/v1/docs", Scalar({ url: "/api/v1/openapi.json" }));

export default {
  port: env.API_PORT,
  fetch: app.fetch,
};
