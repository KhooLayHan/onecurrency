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
});
