import { beforeEach, describe, expect, test } from "bun:test";
import pino from "pino";
import { createTestTransport, TestAppender } from "./TestAppender";

// Create a test logger with the appender
function createTestLogger(appender: TestAppender) {
  return pino(
    {
      level: "debug",
      base: { service: "test" },
    },
    createTestTransport(appender)
  );
}

describe("Sensitive Data Protection", () => {
  let appender: TestAppender;
  let logger: pino.Logger;

  beforeEach(() => {
    appender = new TestAppender();
    logger = createTestLogger(appender);
  });

  describe("Email Masking", () => {
    test("should mask email addresses in production mode", () => {
      // Simulate production redaction
      const user = {
        id: "123",
        email: "john.doe@example.com",
        name: "John Doe",
      };
      logger.info({ event: "user.login", user });
      const log = appender.getLastLog();
      expect(log).not.toContain("john.doe@example.com");
      expect(log).toContain("joh***@example.com");
    });
    test("should mask multiple email addresses", () => {
      const users = [{ email: "alice@example.com" }, { email: "bob@test.org" }];
      logger.info({ event: "users.list", users });
      const log = appender.getLastLog();
      expect(log).not.toContain("alice@example.com");
      expect(log).not.toContain("bob@test.org");
      expect(log).toContain("ali***@example.com");
      expect(log).toContain("bo***@test.org");
    });
  });

  describe("Credential Redaction", () => {
    test("should not log passwords", () => {
      const credentials = {
        username: "john_doe",
        password: "super_secret_password_123",
      };
      logger.info({ event: "auth.attempt", credentials });
      const log = appender.getLastLog();
      expect(log).not.toContain("super_secret_password_123");
      expect(log).not.toContain('"password"'); // Field should be removed
    });
    test("should not log API keys", () => {
      const config = {
        apiKey: "sk_live_abcdefghijklmnopqrstuvwxyz",
        endpoint: "https://api.example.com",
      };
      logger.info({ event: "config.loaded", config });
      const log = appender.getLastLog();
      expect(log).not.toContain("sk_live_");
    });
    test("should not log session tokens", () => {
      const session = {
        userId: "123",
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      };
      logger.info({ event: "session.created", session });
      const log = appender.getLastLog();
      expect(log).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
    });
  });

  describe("Financial Data Protection", () => {
    test("should not log full wallet addresses", () => {
      const wallet = {
        id: "wallet_123",
        address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        network: "ethereum",
      };
      logger.info({ event: "wallet.created", wallet });
      const log = appender.getLastLog();
      // Should either not log or mask the address
      expect(log).not.toContain("0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb");
    });
    test("should not log credit card numbers", () => {
      const payment = {
        method: "credit_card",
        cardNumber: "4111111111111111",
        cvv: "123",
      };
      logger.info({ event: "payment.processed", payment });
      const log = appender.getLastLog();
      expect(log).not.toContain("4111111111111111");
      expect(log).not.toContain("123");
    });
    test("should not log private keys", () => {
      const keys = {
        publicKey: "0xpublic...",
        privateKey:
          "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
      };
      logger.info({ event: "keys.generated", keys });
      const log = appender.getLastLog();
      expect(log).not.toContain(
        "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
      );
    });
  });

  describe("Log Format Standards", () => {
    test("should use ISO-8601 timestamps", () => {
      logger.info({ event: "test" });
      const log = appender.getLastLogAsJson();
      const timestamp = log["@timestamp"] || log.time;
      expect(timestamp).toBeDefined();
      expect(timestamp).toMatch(/^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}/);
    });
    test("should use snake_case field names", () => {
      const data = {
        user_id: "123",
        deposit_amount: 1000,
        transaction_hash: "0xabc...",
      };
      logger.info({ event: "test", data });
      const log = appender.getLastLog();
      // Should not contain camelCase
      expect(log).not.toMatch(/"userId":/);
      expect(log).not.toMatch(/"depositAmount":/);
    });
    test("should include correlation ID", () => {
      logger.info({
        event: "test",
        correlation_id: "req_550e8400-e29b-41d4-a716-446655440000",
      });
      const log = appender.getLastLogAsJson();
      expect(log.correlation_id).toBe(
        "req_550e8400-e29b-41d4-a716-446655440000"
      );
    });
  });

  describe("Error Handling", () => {
    test("should include error codes", () => {
      const error = {
        code: "STRIPE_CARD_DECLINED",
        message: "Card was declined",
      };
      logger.error({ event: "payment.failed", error });
      const log = appender.getLastLogAsJson();
      expect(log.error.code).toBe("STRIPE_CARD_DECLINED");
    });
    test("should sanitize error details", () => {
      const error = {
        code: "VALIDATION_FAILED",
        details: {
          field: "email",
          attemptedValue: "test@example.com",
          password: "secret123", // Should be redacted
        },
      };
      logger.error({ event: "validation.failed", error });
      const log = appender.getLastLog();
      expect(log).toContain("VALIDATION_FAILED");
      expect(log).not.toContain("secret123");
    });
  });

  describe("HTTP Request Logging", () => {
    test("should mask IP addresses in production", () => {
      const request = {
        method: "POST",
        path: "/api/deposits",
        ip_address: "192.168.1.100",
      };
      logger.info({ event: "http.request", request });
      const log = appender.getLastLog();
      // Should not contain full IP in production-like logs
      expect(log).not.toContain("192.168.1.100");
    });
    test("should track request duration", () => {
      logger.info({
        event: "http.request",
        request: {
          method: "GET",
          path: "/api/status",
          duration_ms: 150,
        },
      });
      const log = appender.getLastLogAsJson();
      expect(log.request.duration_ms).toBe(150);
    });
  });
});
