// import type { MiddlewareHandler } from "hono";
// import { env } from "../env";
// import { logger } from "../lib/logger";

// const RADIX_BASE = 36;
// const RANDOM_START_INDEX = 2;
// const RANDOM_LENGTH = 6;

// const CLIENT_ERROR_THRESHOLD = 400;
// const SERVER_ERROR_THRESHOLD = 500;

// const MILLISECONDS_PER_SECOND = 1000;

// function generateCorrelationId(): string {
//   const timestamp = Date.now().toString(RADIX_BASE);
//   const random = Math.random()
//     .toString(RADIX_BASE)
//     .substring(RANDOM_START_INDEX, RANDOM_START_INDEX + RANDOM_LENGTH);
//   return `req_${timestamp}_${random}`;
// }

// function extractClientInfo(c: {
//   req: {
//     header: (name: string) => string | undefined;
//   };
// }): { country?: string; city?: string } {
//   const cfIPCountry = c.req.header("CF-IPCountry");
//   if (cfIPCountry) {
//     return { country: cfIPCountry };
//   }

//   return {};
// }

// function getSeverityFromStatusCode(statusCode: number): string {
//   if (statusCode >= SERVER_ERROR_THRESHOLD) {
//     return "error";
//   }
//   if (statusCode >= CLIENT_ERROR_THRESHOLD) {
//     return "warn";
//   }
//   return "info";
// }

// export const requestLoggingMiddleware: MiddlewareHandler = async (c, next) => {
//   const startTime = performance.now();
//   const correlationId =
//     c.req.header("x-correlation-id") || generateCorrelationId();

//   c.header("x-correlation-id", correlationId);

//   const requestId = generateCorrelationId();
//   const clientInfo = extractClientInfo(c);

//   const requestLogger = logger.child({
//     request: {
//       request_id: requestId,
//       correlation_id: correlationId,
//       method: c.req.method,
//       path: c.req.path,
//     },
//     actor: {
//       user_type: "",
//       ip_country: clientInfo.country,
//       ip_city: clientInfo.city,
//     },
//   });

//   requestLogger.info(`Request started: ${c.req.method} ${c.req.path}`, {
//     event: {
//       type: "request.started",
//       category: "system",
//       severity: "debug",
//       outcome: "success",
//       correlation_id: correlationId,
//     },
//   });

//   try {
//     await next();

//     const duration = Math.round(performance.now() - startTime);
//     const statusCode = c.res.status;

//     const outcome =
//       statusCode >= CLIENT_ERROR_THRESHOLD ? "failure" : "success";
//     const severity = getSeverityFromStatusCode(statusCode);

//     requestLogger.info(`Request completed: ${statusCode}`, {
//       event: {
//         type: "request.completed",
//         category: "system" as const,
//         severity,
//         outcome,
//         correlation_id: correlationId,
//       },
//       request: {
//         method: c.req.method,
//         path: c.req.path,
//         status_code: statusCode,
//         duration_ms: duration,
//         request_id: requestId,
//       },
//     });
//   } catch (error) {
//     const duration = Math.round(performance.now() - startTime);
//     const errorMessage = error instanceof Error ? error.message : String(error);

//     logger.error(`Request failed: ${errorMessage}`, {
//       event: {
//         type: "request.failed",
//         category: "system" as const,
//         severity: "error" as const,
//         outcome: "failure" as const,
//         correlation_id: correlationId,
//       },
//       request: {
//         method: c.req.method,
//         path: c.req.path,
//         status_code: 500,
//         duration_ms: duration,
//         request_id: requestId,
//       },
//       error: {
//         type: "request.failed",
//         code: "INTERNAL_ERROR",
//         user_message: "An unexpected error occurred. Please try again later.",
//         internal_message: errorMessage,
//       },
//       actor: {
//         user_type: "anonymous",
//         ip_country: "",
//         // ip_country: clientInfo.country,
//         // ip_city: clientInfo.city,
//       },
//     });

//     throw error;
//   }
// };

// export const correlationIdMiddleware: MiddlewareHandler = async (c, next) => {
//   const correlationId =
//     c.req.header("x-correlation-id") || generateCorrelationId();
//   c.set("correlationId", correlationId);
//   c.header("x-correlation-id", correlationId);
//   await next();
// };

// export const errorLoggingMiddleware: MiddlewareHandler = async (c, next) => {
//   try {
//     await next();
//   } catch (error) {
//     const correlationId = c.get("correlationId") || "unknown";

//     const errorMessage = error instanceof Error ? error.message : String(error);
//     const stack =
//       env.NODE_ENV === "development" && error instanceof Error
//         ? error.stack
//         : undefined;

//     logger.error(`Unhandled error: ${errorMessage}`, {
//       event: {
//         type: "system.error",
//         category: "system" as const,
//         severity: "error" as const,
//         outcome: "failure" as const,
//         correlation_id: correlationId,
//       },
//       error: {
//         type: "unhandled_error",
//         code: "INTERNAL_SERVER_ERROR",
//         user_message: "An unexpected error occurred. Please try again later.",
//         internal_message: errorMessage,
//       },
//       request: {
//         correlation_id: correlationId,
//         method: c.req.method,
//         path: c.req.path,
//       },
//       context: env.NODE_ENV === "development" ? { stack } : undefined,
//     });

//     if (error instanceof Error) {
//       throw error;
//     }
//     throw new Error(String(error));
//   }
// };

// export const rateLimitLoggingMiddleware = (
//   limit: number,
//   windowMs: number
// ): MiddlewareHandler => {
//   const requests = new Map<string, number[]>();

//   return async (c, next) => {
//     const clientId = c.req.header("x-forwarded-for") || "unknown";
//     const now = Date.now();

//     const clientRequests = requests.get(clientId) || [];
//     const recentRequests = clientRequests.filter(
//       (time) => now - time < windowMs
//     );

//     if (recentRequests.length >= limit) {
//       const correlationId = c.get("correlationId") || "unknown";

//       logger.warn(`Rate limit hit for client: ${clientId}`, {
//         event: {
//           type: "rate.limit.hit",
//           category: "compliance" as const,
//           severity: "warn" as const,
//           outcome: "failure" as const,
//           correlation_id: correlationId,
//         },
//         actor: {
//           user_type: "anonymous" as const,
//         },
//         context: {
//           client_id: clientId,
//           limit,
//           window_ms: windowMs,
//           request_count: recentRequests.length,
//         },
//       });

//       return c.json(
//         {
//           error: "Too many requests",
//           code: "RATE_LIMIT_EXCEEDED",
//           retry_after: Math.ceil(windowMs / MILLISECONDS_PER_SECOND),
//         },
//         429
//       );
//     }

//     recentRequests.push(now);
//     requests.set(clientId, recentRequests);

//     await next();
//   };
// };
