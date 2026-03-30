import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./auth";
import { env } from "./env";
// import { logger } from "./lib/logger";
import { depositsRouter } from "./routes/deposits";

const app = new Hono();

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
    // allowHeaders: [
    //   "Content-Type",
    //   "Authorization",
    //   "X-Custom-Header",
    //   "Upgrade-Insecure-Requests",
    // ],
    // allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length", "X-Kuma-Revision"],
    maxAge: 600,
    credentials: true,
  })
);

app.get("/", (c) => c.json({ message: "Hello Hono!", status: "ok" }));

app.get("/api/health", (c) =>
  c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  })
);

// Unsure why got CORS errors
app.use("/api/*", async (c, next) => {
  // Grab the session securely using the headers
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (session?.user) {
    // Inject it into the Hono Context so c.get("session") works in your routes
    c.set("session", session.user);
  }

  await next();
});

app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

app.route("/api/deposits", depositsRouter);

export default {
  port: env.API_PORT,
  fetch: app.fetch,
};
