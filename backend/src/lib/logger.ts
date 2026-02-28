import pino from "pino";

// Environment detection
const env = process.env.NODE_ENV || "development";
const isDev = env === "development";
const isStaging = env === "staging";

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
  if (env === "production") {
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
    service: "onecurrency-backend",
    version: process.env.npm_package_version || "1.0.0",
    environment: env,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label: string) => ({ level: label.toUpperCase() }),
    // Add binding formatter for consistent structure
    bindings: (bindings: pino.Bindings) => ({
      pid: bindings.pid,
      hostname: bindings.hostname,
    }),
  },
  redact: {
    paths: getRedactionPaths(),
    remove: true, // Completely remove instead of [Redacted]
  },
  hooks: {
    logMethod(inputArgs, method, level) {
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

// Add pretty printing for development
if (isDev) {
  loggerConfig.transport = {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
    },
  };
}

// Create the logger instance
export const logger = pino(loggerConfig);

// Sampling utility for production
export const shouldLog = (category: string): boolean => {
  if (env !== "production") {
    return true;
  }

  // Always log deposits and critical events
  if (
    category === "deposit" ||
    category === "security" ||
    category === "compliance"
  ) {
    return true;
  }

  // Sample other categories at 10% in production
  const SAMPLING_RATE = 0.1;
  return Math.random() < SAMPLING_RATE;
};

// Child logger factory with bound context
export const createChildLogger = (
  bindings: Record<string, unknown>
): pino.Logger => logger.child(bindings);
