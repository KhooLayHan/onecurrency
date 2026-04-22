import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { openAPIRouteHandler } from "hono-openapi";
import { auth } from "./auth";
import { env } from "./env";
// import { logger } from "./lib/logger";
import { depositsRouter } from "./routes/deposits/deposits";
import { usersRouter } from "./routes/users";

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

// Unsure why got CORS errors
v1.use("*", async (c, next) => {
  // Grab the session securely using the headers
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (session?.user) {
    // Inject it into the Hono Context so c.get("session") works in your routes
    c.set("session", { userId: Number(session.user.id) });
  }

  await next();
});

v1.on(["POST", "GET"], "/auth/**", (c) => auth.handler(c.req.raw));

v1.route("/deposits", depositsRouter);

v1.route("/users", usersRouter);

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
