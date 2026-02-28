import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { env } from "./env";

const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowHeaders: ["X-Custom-Header", "Upgrade-Insecure-Requests"],
    allowMethods: ["POST", "GET", "OPTIONS"],
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

app.on(["POST", "GET"], "/api/auth/**", (c) => auth.handler(c.req.raw));

// export default app;

export default {
  port: env.API_PORT,
  fetch: app.fetch,
};
