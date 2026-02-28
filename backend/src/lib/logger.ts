import pino from "pino";
import { env } from "../env";

const REDACTION_PATHS = [
  "*.password",
  "*.token",
  "*.secret",
  "*.api_key",
  "*.apiKey",
  "headers.authorization",
  "headers.cookie",
  "*.privateKey",
  "*.private_key",
  "*.mnemonic",
  "*.seedPhrase",
  "*.seed_phrase",
  "*.creditCard",
  "*.credit_card",
  "*.cvv",
  "*.bankAccount",
  "*.bank_account",
  "*.ssn",
  "*.socialSecurity",
  "*.encryption_key",
  "*.master_key",
  "*.jwt",
  "*.session_token",
  "*.access_token",
  "*.refresh_token",
  "context.password",
  "context.credit_card",
  "context.cvv",
  "context.bank_account",
  "context.ssn",
  "actor.ip_address",
  "actor.user_agent",
];

const LOG_LEVELS = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
} as const;

const SERVICE_INFO = {
  name: "onecurrency-backend",
  version: "1.0.0",
  environment: env.NODE_ENV,
  component: "api",
} as const;

function maskEmail(email: string): string {
  const MAX_LENGTH = 3;

  if (!email.includes("@")) {
    return "***";
  }

  const [local, domain] = email.split("@");
  if (!(local && domain)) {
    return "***";
  }

  const maskedLocal =
    local.length > MAX_LENGTH ? `${local.slice(0, MAX_LENGTH)}***` : "***";
  return `${maskedLocal}@${domain}`;
}

const baseLogger = pino({
  level: env.NODE_ENV === "development" ? "debug" : "info",
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label: string) => ({ severity: label }),
    log: (obj: Record<string, unknown>) => ({
      service: SERVICE_INFO,
      ...obj,
    }),
  },
  redact: {
    paths: REDACTION_PATHS,
    censor: (value: unknown, path: string[]) => {
      const pathStr = path.join(".");

      if (
        pathStr.includes("email") &&
        typeof value === "string" &&
        value.includes("@")
      ) {
        return maskEmail(value);
      }

      return "[REDACTED]";
    },
  },
  base: null,
});

export type LogLevel = keyof typeof LOG_LEVELS;

export type LogContext = {
  [key: string]: unknown;
};

export type LogEvent = {
  type: string;
  category?: "authentication" | "business" | "compliance" | "system";
  severity?: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
  outcome?: "success" | "failure";
  correlation_id?: string;
};

export type LogActor = {
  user_id?: string | null;
  user_type?: "anonymous" | "authenticated" | "admin" | "system";
  ip_country?: string;
  ip_city?: string;
};

export type LogRequest = {
  method?: string;
  path?: string;
  status_code?: number;
  duration_ms?: number;
  request_id?: string;
};

export type LogError = {
  type?: string;
  code?: string;
  user_message?: string;
  internal_message?: string;
};

export type LogMetadata = {
  event?: LogEvent;
  actor?: LogActor;
  request?: LogRequest;
  error?: LogError;
  context?: LogContext;
};

export const logger = {
  trace: (msg: string, meta?: LogMetadata) =>
    baseLogger.trace({ ...meta, message: msg }),
  debug: (msg: string, meta?: LogMetadata) =>
    baseLogger.debug({ ...meta, message: msg }),
  info: (msg: string, meta?: LogMetadata) =>
    baseLogger.info({ ...meta, message: msg }),
  warn: (msg: string, meta?: LogMetadata) =>
    baseLogger.warn({ ...meta, message: msg }),
  error: (msg: string, meta?: LogMetadata) =>
    baseLogger.error({ ...meta, message: msg }),
  fatal: (msg: string, meta?: LogMetadata) =>
    baseLogger.fatal({ ...meta, message: msg }),

  child: (bindings: Record<string, unknown>) => {
    const childLogger = baseLogger.child(bindings);
    return {
      trace: (msg: string, meta?: LogMetadata) =>
        childLogger.trace({ ...meta, message: msg }),
      debug: (msg: string, meta?: LogMetadata) =>
        childLogger.debug({ ...meta, message: msg }),
      info: (msg: string, meta?: LogMetadata) =>
        childLogger.info({ ...meta, message: msg }),
      warn: (msg: string, meta?: LogMetadata) =>
        childLogger.warn({ ...meta, message: msg }),
      error: (msg: string, meta?: LogMetadata) =>
        childLogger.error({ ...meta, message: msg }),
      fatal: (msg: string, meta?: LogMetadata) =>
        childLogger.fatal({ ...meta, message: msg }),
    };
  },
};

export type Logger = typeof logger;
