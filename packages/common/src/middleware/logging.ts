// import type { Context, Next } from "hono";
// import { logger, shouldLog } from "../lib/logger";

// // Extend Hono context types
// declare module "hono" {
//   interface ContextVariableMap {
//     requestId: string;
//     startTime: number;
//     userId?: string;
//   }
// }

// // Extract country from various sources (headers, CF, etc.)
// const extractCountry = (c: Context): string => {
//   // Try Cloudflare header first
//   const cfCountry = c.req.header("CF-IPCountry");
//   if (cfCountry) {
//     return cfCountry;
//   }
//   // Try custom header
//   const customCountry = c.req.header("X-Country-Code");
//   if (customCountry) {
//     return customCountry;
//   }
//   // Default
//   return "unknown";
// };
// // Generate correlation ID
// const generateRequestId = (): string => `req_${crypto.randomUUID()}`;

// export async function loggingMiddleware(c: Context, next: Next) {
//   const startTime = Date.now();
//   const requestId = generateRequestId();

//   // Store in context for correlation
//   c.set("requestId", requestId);
//   c.set("startTime", startTime);
//   // Add to response headers
//   c.header("X-Request-ID", requestId);
//   // Execute request

//   await next();

//   // Calculate duration
//   const duration = Date.now() - startTime;
//   const statusCode = c.res.status;

//   // Determine log level based on status
//   let severity = "info";
//   if (statusCode >= 500) {
//     severity = "error";
//   } else if (statusCode >= 400) {
//     severity = "warn";
//   }

//   // Determine category for sampling
//   const category = c.req.path.includes("/deposits")
//     ? "deposit"
//     : c.req.path.includes("/auth")
//       ? "security"
//       : "api";

//   // Check sampling
//   if (!shouldLog(category)) return;

//   // Build log entry (canonical log line, BetterStack best practice)
//   const logEntry = {
//     "@timestamp": new Date().toISOString(),
//     event: {
//       type: "http.request",
//       category,
//       severity,
//       outcome: statusCode < 400 ? "success" : "failure",
//       correlation_id: requestId,
//     },
//     actor: {
//       user_id: c.get("userId") || null,
//       user_type: c.get("userId") ? "authenticated" : "anonymous",
//       ip_country: extractCountry(c),
//       // ip_city: skipped for MVP (requires GeoIP database)
//     },
//     request: {
//       method: c.req.method,
//       path: c.req.path,
//       status_code: statusCode,
//       duration_ms: duration,
//       request_id: requestId,
//     },
//     http: {
//       // Additional HTTP context
//       content_length: c.res.headers.get("content-length"),
//       content_type: c.res.headers.get("content-type"),
//     },
//   };

//   // Log at appropriate level
//   if (severity === "error") {
//     logger.error(logEntry);
//   } else if (severity === "warn") {
//     logger.warn(logEntry);
//   } else {
//     logger.info(logEntry);
//   }
// }

// // Error logging middleware (captures uncaught errors)
// export function errorLoggingMiddleware(err: Error, c: Context): Response {
//   const requestId = c.get("requestId") || "unknown";
//   logger.error({
//     event: {
//       type: "http.error",
//       category: "system",
//       severity: "error",
//       outcome: "failure",
//       correlation_id: requestId,
//     },
//     error: {
//       type: err.name,
//       message: err.message,
//       // Stack trace only in development
//       stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
//     },
//     request: {
//       method: c.req.method,
//       path: c.req.path,
//       request_id: requestId,
//     },
//   });
//   // Return safe error response to client
//   return c.json(
//     {
//       error: {
//         message: "Internal server error",
//         reference: generateReference(),
//       },
//     },
//     500
//   );
// }

// function generateReference(): string {
//   return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
// }
