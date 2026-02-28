import { Hono } from "hono";
import {
  logSystemCrash,
  logSystemShutdown,
  logSystemStartup,
} from "./lib/errors";
import {
  correlationIdMiddleware,
  errorLoggingMiddleware,
  requestLoggingMiddleware,
} from "./middleware/logging";

const app = new Hono();

app.use(correlationIdMiddleware);
app.use(errorLoggingMiddleware);
app.use(requestLoggingMiddleware);

app.get("/", (c) => c.json({ message: "Hello Hono!", status: "ok" }));

app.get("/api/health", (c) =>
  c.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  })
);

process.on("SIGTERM", () => {
  logSystemShutdown("SIGTERM");
  process.exit(0);
});

process.on("SIGINT", () => {
  logSystemShutdown("SIGINT");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  logSystemCrash(error);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason));
  logSystemCrash(error);
  process.exit(1);
});

logSystemStartup();

export default app;
