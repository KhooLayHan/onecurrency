import { Hono } from "hono";

const app = new Hono();

// app.use(correlationIdMiddleware);
// app.use(errorLoggingMiddleware);
// app.use(requestLoggingMiddleware);

app.get("/", (c) => c.json({ message: "Hello Hono!", status: "ok" }));

app.get("/api/health", (c) =>
  c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  })
);

export default app;
