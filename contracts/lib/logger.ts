// import { createBaseLogger } from "../../packages/common/src/lib/logger.js";
import { env } from "../env";

export const logger = createBaseLogger({
  env: env.NODE_ENV,
  version: process.env.npm_package_version || "1.0.0",
  logLevel: env.NODE_ENV === "development" ? "debug" : "info",
  serviceName: "onecurrency-contracts",
  betterStackToken: env.BETTERSTACK_SOURCE_TOKEN,
});

import pino from "pino";

export type LoggerConfig = {
  env: "development" | "staging" | "production" | "testing";
  version?: string;
  logLevel: string;
  serviceName: string;
  betterStackToken?: string;
};

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

export function createBaseLogger(config: LoggerConfig) {
  // Environment detection
  const environment = config.env || "development";
  const isDev = config.env === "development";
  const isStaging = config.env === "staging";

  // Environment-specific redaction paths
  const getRedactionPaths = (): string[] => {
    const basePaths = [
      "*.password",
      "*.secret",
      "*.privateKey",
      "*.apiKey",
      "*.mnemonic",
      "*.seedPhrase",
      "*.creditCard",
      "*.cvv",
      "headers.authorization",
      "headers.cookie",
    ];

    // Production: aggressive redaction
    if (environment === "production") {
      return [
        ...basePaths,
        "actor.ip_address", // Country only
        "actor.user_agent", // Not logged
        "actor.email", // Not logged (use user_id)
        "context.wallet_address", // Not logged
        "context.email", // Not logged
        "*.internal_details", // Not exposed
      ];
    }

    // Staging: standard redaction
    if (isStaging) {
      return [
        ...basePaths,
        "actor.ip_address", // Masked
        "context.wallet_address", // Masked
      ];
    }

    // Development: minimal redaction (only credentials)
    return basePaths;
  };

  const loggerConfig: pino.LoggerOptions = {
    level: isDev ? "debug" : "info",

    base: {
      service: config.serviceName,
      version: config.version,
      environment: config.env,
    },

    timestamp: pino.stdTimeFunctions.isoTime,

    formatters: {
      level: (label: string) => ({ level: label.toUpperCase() }),

      bindings: (bindings: pino.Bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
      }),
    },

    redact: {
      paths: getRedactionPaths(),

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

    hooks: {
      logMethod(inputArgs, method, _level) {
        // Ensure errors are properly serialized
        if (inputArgs[0] instanceof Error) {
          const err = inputArgs[0];
          inputArgs[0] = {
            err: {
              type: err.name,
              message: err.message,
              stack: isDev ? err.stack : undefined,
            },
          };
        }
        method.apply(this, inputArgs);
      },
    },
  };

  if (config.env === "development") {
    loggerConfig.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      },
    };
  }

  return pino(loggerConfig);
}
