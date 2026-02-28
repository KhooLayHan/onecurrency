# OneCurrency Logging System Plan

## Executive Summary

This document establishes a centralized, security-focused logging system for OneCurrency, a fiat-to-crypto on-ramp platform. The system follows **BetterStack best practices**, **OWASP Logging Cheat Sheet** guidelines, and **12-Factor App methodology**.

**Key Principles:**

- **Dual Storage**: PostgreSQL (permanent audit) + BetterStack (7-day observability)
- **12-Factor Compliance**: Strict stdout output, environment-based configuration
- **Data Minimization**: Aggressive PII redaction following GDPR/CCPA/PCI DSS
- **Functional Error Handling**: Railway-oriented programming with `neverthrow`

## Architecture

```text
┌───────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                             │
├───────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   ┌──────────────┐          ┌──────────────┐                          │
│   │   Frontend   │          │   Backend    │                          │
│   │  (Next.js)   │◄─────────│   (Hono)     │                          │
│   │              │   HTTP   │              │                          │
│   │ User-safe    │          │  neverthrow  │                          │
│   │   Errors     │          │  Pino→stdout │                          │
│   └──────────────┘          └──────┬───────┘                          │
│                                    │              TCP / Drizzle       │
│                     ┌──────────────│─────────────────┐                │
│                     │                                │                │
│                     ▼                                ▼                │
│               ┌──────────┐   ┌─────────────┐   ┌────────────┐         │
│               │ Docker   │   │ BetterStack │   │ PostgreSQL │         │
│               │ Log      │──►│ (7 days)    │   │ (Permanent)│         │
│               │ Driver   │   │ • Alerts    │   │ • Audit    │         │
│               └──────────┘   │ • Search    │   │ • Ledger   │         │
│                              │ • Metrics   │   │ • Source   │         │
│                              └─────────────┘   └────────────┘         │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Stdout Only (12-Factor)**: All logs written to stdout, collected by Docker log driver
2. **Dual Purpose Storage**:
   - **BetterStack**: Observability, alerting, search, 7-day retention
   - **PostgreSQL**: Permanent audit trail, compliance, financial ledger
3. **Functional Error Handling**: `neverthrow` library for composable error handling with automatic logging
4. **Strict Data Minimization**: Never log PII, credentials, or sensitive financial data

## Technology Stack

| Component          | Technology            | Purpose                                         |
| ------------------ | --------------------- | ----------------------------------------------- |
| **Logger**         | Pino 10.x             | High-performance structured JSON logging        |
| **HTTP Logger**    | pino-http             | Hono middleware for request logging             |
| **Error Handling** | neverthrow            | Railway-oriented programming, functional errors |
| **Log Shipper**    | Vector 0.40.x         | Log transformation, routing, buffering          |
| **Observability**  | BetterStack           | Centralized aggregation, alerting, search       |
| **Audit Storage**  | PostgreSQL + Triggers | Permanent compliance audit trail                |
| **Transport**      | Docker Log Driver     | Stdout collection (12-Factor)                   |

### Why These Choices?

- **Pino**: 5x faster than alternatives, built-in redaction, JSON native
- **neverthrow**: Type-safe error handling, composable pipelines, automatic error logging
- **Vector**: High-performance, memory-efficient, native BetterStack integration
- **BetterStack**: Free tier friendly, excellent search, built-in alerting

## Environment Configuration

| Setting            | Development       | Staging  | Production (Future)      |
| ------------------ | ----------------- | -------- | ------------------------ |
| **Log Level**      | `debug`           | `info`   | `warn`                   |
| **Sampling**       | 100% all          | 100% all | 100% deposits, 10% reads |
| **Redaction**      | Minimal           | Standard | Aggressive               |
| **Stack Traces**   | Full              | None     | None                     |
| **Pretty Print**   | Yes (pino-pretty) | No       | No                       |
| **Output**         | stdout            | stdout   | stdout                   |
| **Timestamp**      | ISO-8601          | ISO-8601 | ISO-8601                 |
| **Correlation ID** | Yes               | Yes      | Yes                      |

### Environment Variables

```bash
# BetterStack Configuration (already configured)
BETTERSTACK_SOURCE_TOKEN=your_source_token_here
BETTERSTACK_INGESTING_HOST=logs.betterstack.com

# Alerting
ALERT_EMAIL=alerts@yourdomain.com

# Environment
NODE_ENV=development  # development|staging|production
LOG_LEVEL=debug      # debug|info|warn|error
```

## Log Schema Standards

### Base Schema (All Events)

```json
{
  "@timestamp": "2026-02-26T10:30:00.000Z",
  "service": {
    "name": "onecurrency-backend",
    "version": "1.0.0",
    "environment": "development|staging|production",
    "component": "api",
    "instance": "i-0a1b2c3d"
  },
  "event": {
    "type": "deposit.initiated",
    "category": "authentication|business|compliance|system",
    "severity": "info|warn|error|critical",
    "outcome": "success|failure",
    "correlation_id": "req_550e8400-e29b-41d4-a716-446655440000"
  },
  "actor": {
    "user_id": "user_uuid|null",
    "user_type": "anonymous|authenticated|admin|system",
    "ip_country": "US",
    "ip_city": "San Francisco"
  },
  "request": {
    "method": "POST",
    "path": "/api/v1/deposits",
    "status_code": 200,
    "duration_ms": 150,
    "request_id": "req_uuid"
  },
  "context": {
    // Event-specific minimal context
  },
  "error": {
    "type": "STRIPE_CARD_DECLINED",
    "code": "card_declined",
    "user_message": "Your payment was declined...",
    "internal_message": "Full details for debugging"
  }
}
```

### Field Naming Conventions

- **snake_case** for all fields: `user_id`, `deposit_amount`
- **Units in names**: `amount_usd_cents`, `duration_ms`, `size_bytes`
- **No abbreviations**: `user_id` not `uid`, `transaction_id` not `txId`
- **ISO-8601 timestamps**: `2026-02-26T10:30:00.000Z`

## Critical Events (Email Alerts)

**STRICT - Only these 10 events trigger email alerts:**

| Event                       | Severity | Alert Reason          | Sample Rate |
| --------------------------- | -------- | --------------------- | ----------- |
| `system.startup`            | INFO     | Deployment tracking   | 100%        |
| `system.crash`              | CRITICAL | Immediate attention   | 100%        |
| `system.shutdown`           | WARN     | Unexpected downtime   | 100%        |
| `db.connection.failed`      | ERROR    | Data layer down       | 100%        |
| `deposit.blockchain.failed` | ERROR    | User funds at risk    | 100%        |
| `deposit.stripe.failed`     | ERROR    | Revenue impact        | 100%        |
| `encryption.key.error`      | CRITICAL | Security breach       | 100%        |
| `webhook.processing.failed` | WARN     | Critical path blocked | 100%        |
| `auth.system.error`         | ERROR    | Authentication down   | 100%        |
| `rate.limit.hit`            | WARN     | Potential DoS         | 100%        |

### BetterStack Alert Configuration

```yaml
alerts:
  - name: "Blockchain Failure - Critical"
    query: "event.type:deposit.blockchain.failed"
    severity: critical
    channels:
      - email: "${ALERT_EMAIL}"
    throttle: 5m

  - name: "Database Connection Lost"
    query: "event.type:db.connection.failed"
    severity: critical
    channels:
      - email: "${ALERT_EMAIL}"
    throttle: 1m

  - name: "System Crash"
    query: "event.type:system.crash OR event.type:system.shutdown"
    severity: critical
    channels:
      - email: "${ALERT_EMAIL}"
    throttle: 0 # No throttling for crashes

  - name: "Sensitive Data Leak Detection"
    query: 'message.email:* AND NOT message.email:"******" OR message.password:* AND NOT message.password:"[REDACTED]"'
    severity: critical
    channels:
      - email: "${ALERT_EMAIL}"
    throttle: 0
```

## KPI Tracking via Logs

### 1. Bridging Success Rate

**Event Chain:**

```text
deposit.initiated
  ↓
deposit.stripe.success
  ↓
deposit.blockchain.submitted
  ↓
deposit.blockchain.confirmed (SUCCESS)
OR
deposit.blockchain.failed (FAILURE)
```

**Log Schema:**

```json
{
  "event": "deposit.lifecycle",
  "stage": "initiated|payment_confirmed|blockchain_submitted|confirmed|failed",
  "kpi_data": {
    "deposit_id": "dep_uuid",
    "user_id": "user_uuid",
    "initiated_at": "2026-02-26T10:30:00Z",
    "confirmed_at": "2026-02-26T10:31:45Z",
    "failure_stage": null,
    "failure_reason": null,
    "success": true
  }
}
```

### 2. TVL / Deposit Volume (Hourly Aggregation)

```json
{
  "event": "metrics.tvl.hourly",
  "timestamp": "2026-02-26T10:00:00Z",
  "metrics": {
    "period": "1h",
    "deposits_initiated_count": 42,
    "deposits_confirmed_count": 38,
    "deposits_failed_count": 4,
    "total_volume_usd_cents": 5000000,
    "total_tokens_minted_eth": "25.5",
    "total_tokens_minted_usd": "51000.00",
    "avg_deposit_usd_cents": 119047,
    "unique_users": 25
  }
}
```

### 3. Time-to-Finality (Per Deposit)

```json
{
  "event": "performance.latency",
  "operation": "deposit_full_lifecycle",
  "durations_ms": {
    "stripe_processing": 25000,
    "blockchain_submission": 3000,
    "blockchain_confirmation": 77000,
    "total_e2e": 105000
  },
  "context": {
    "network": "sepolia",
    "gas_price_gwei": 25.5,
    "confirmations_required": 12
  }
}
```

### 4. KYC Drop-off Rate

```json
{
  "event": "kyc.funnel",
  "user_id": "user_uuid",
  "stage": "landing|started|documents_uploaded|submitted|verified|rejected",
  "previous_stage": "started",
  "time_in_previous_stage_minutes": 5,
  "drop_off": false,
  "completion": {
    "started_to_submitted_minutes": 15,
    "submitted_to_verified_hours": 24
  }
}
```

## Data Protection & Sensitive Data

### NEVER LOG (Complete Exclusion)

| Data Type                     | Risk                 | Compliance    |
| ----------------------------- | -------------------- | ------------- |
| Plaintext passwords           | Account takeover     | PCI DSS, GDPR |
| Session tokens (JWT/cookies)  | Session hijacking    | PCI DSS       |
| API keys & secrets            | Privilege escalation | SOC 2         |
| Private keys (even encrypted) | Asset theft          | PCI DSS       |
| Database connection strings   | Data breach          | SOC 2         |
| Credit card numbers (full)    | Financial fraud      | PCI DSS       |
| Bank account numbers (full)   | Banking fraud        | PCI DSS       |
| SSN / Government IDs          | Identity theft       | GDPR, CCPA    |
| Encryption keys               | Data decryption      | PCI DSS       |

### MASKING RULES

| Data Type          | Original                | Production           | Staging              | Development          |
| ------------------ | ----------------------- | -------------------- | -------------------- | -------------------- |
| **Email**          | `john@example.com`      | `joh***@example.com` | `joh***@example.com` | `joh***@example.com` |
| **Wallet Address** | `0x1234567890abcdef...` | Not logged           | `0x1234...cdef`      | `0x1234...cdef`      |
| **TX Hash**        | `0xabc123def456...`     | Not logged           | `0xabc1...f456`      | `0xabc1...f456`      |
| **IP Address**     | `192.168.1.1`           | `US` (country only)  | `192.168.x.x`        | Full                 |
| **User Agent**     | Mozilla/5.0...          | Not logged           | Browser/OS only      | Full                 |
| **Error Messages** | Full stack trace        | Error code only      | Sanitized            | Full                 |

### TOKENIZATION (For Internal Reference)

```typescript
// Tokenize wallet addresses for correlation without exposure
function tokenizeWallet(address: string): string {
  return crypto.createHash("sha256").update(address).digest("hex").slice(0, 16); // 16-char token
}

// Usage: wallet_token: "a1b2c3d4e5f6..." instead of full address
```

## Implementation Phases

### Phase 1: Foundation (2 hours)

**Files to Create:**

1. `backend/src/lib/logger.ts` - Pino configuration with redaction
2. `backend/src/lib/errors.ts` - Neverthrow error handling
3. `backend/src/middleware/logging.ts` - HTTP request logging

**Dependencies:**

```bash
cd backend && bun add pino pino-http neverthrow
```

**Acceptance Criteria:**

- [ ] Pino outputs structured JSON to stdout
- [ ] Redaction removes sensitive fields automatically
- [ ] HTTP requests logged with correlation ID
- [ ] Environment-based configuration works

### Phase 2: Deposit Logging (3 hours)

**Files to Create:**

1. `backend/src/lib/deposit-logger.ts` - Deposit-specific logging with neverthrow

**Integration Points:**

- Integrate with existing deposit service
- Add latency tracking at each stage
- Implement composable error handling

**Acceptance Criteria:**

- [ ] All deposit stages logged (initiated → confirmed/failed)
- [ ] Latency tracked per deposit (stripe + blockchain + total)
- [ ] Errors logged with user-safe messages
- [ ] Neverthrow pipeline composes correctly

### Phase 3: Integration (2 hours)

**Files to Create/Update:**

1. `vector.toml` - Vector configuration
2. `docker-compose.yml` - Add logging configuration

**Configuration:**

```yaml
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "100m"
        max-file: "3"

  vector:
    image: timberio/vector:0.40.X-alpine
    volumes:
      - ./vector.toml:/etc/vector/vector.toml:ro
      - /var/run/docker.sock:/var/run/docker.sock:ro
    environment:
      - BETTERSTACK_SOURCE_TOKEN=${BETTERSTACK_SOURCE_TOKEN}
      - BETTERSTACK_INGESTING_HOST=${BETTERSTACK_INGESTING_HOST}
```

**Acceptance Criteria:**

- [ ] Vector ships logs to BetterStack within 5 seconds
- [ ] Docker stdout driver collects logs
- [ ] BetterStack receives and indexes logs
- [ ] Alert rules configured and tested

### Phase 4: Testing & Security (1 hour)

**Files to Create:**

1. `backend/tests/test-appender.ts` - Bun test helper
2. `backend/tests/logging.test.ts` - Sensitive data protection tests

**Test Cases:**

- [ ] Email addresses are masked
- [ ] Wallet addresses are not logged
- [ ] Passwords are redacted
- [ ] ISO-8601 timestamps used
- [ ] Error codes are short and safe

### Phase 5: Validation (2 hours)

**Testing Checklist:**

- [ ] All 10 critical events trigger email alerts
- [ ] PostgreSQL audit logs remain complete
- [ ] No PII in BetterStack logs
- [ ] Latency tracking <1ms overhead
- [ ] Error messages are user-safe
- [ ] System works under load (100 requests/sec)

**_Total Estimated Time: 10 hours_**

## File Structure

```text
backend/
├── src/
│   ├── lib/
│   │   ├── logger.ts           # Pino configuration
│   │   ├── errors.ts           # Neverthrow error handling
│   │   └── deposit-logger.ts   # Deposit-specific logging
│   ├── middleware/
│   │   └── logging.ts          # HTTP request logging
│   └── ...
├── tests/
│   ├── test-appender.ts        # Bun test helper (Option A)
│   └── logging.test.ts         # Sensitive data tests
├── vector.toml                 # Vector configuration
└── ...

docs/
└── LOGGING_PLAN.md             # This document
```

## Testing Strategy

### Sensitive Data Protection Tests

```typescript
// backend/tests/logging.test.ts
import { describe, test, expect, beforeEach } from "bun:test";
import { TestAppender } from "./test-appender";
import logger from "../src/lib/logger";

describe("Sensitive Data Protection", () => {
  let testAppender: TestAppender;

  beforeEach(() => {
    testAppender = new TestAppender();
    logger.addListener(testAppender);
  });

  test("should not log full email addresses", () => {
    const user = { id: "123", email: "test@example.com", password: "secret" };
    logger.info({ event: "user.login", user });

    const logOutput = testAppender.getLastLog();
    expect(logOutput).not.toContain("test@example.com");
    expect(logOutput).toContain("tes***@example.com");
    expect(logOutput).not.toContain("secret");
  });

  test("should use ISO-8601 timestamps", () => {
    logger.info({ event: "test" });

    const log = JSON.parse(testAppender.getLastLog());
    expect(log["@timestamp"]).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
```

### Load Testing

```bash
# Test logging performance impact
wrk -t 4 -c 100 -d 30s http://localhost:3000/api/health

# Verify no log loss under load
# Check BetterStack for 100% of expected log volume
```

## Monitoring & Alerting

### BetterStack Dashboards

**Recommended Dashboards:**

1. **System Health**: Startup/shutdown events, error rates
2. **Deposit Funnel**: Initiated → Confirmed conversion rate
3. **Performance**: Latency percentiles (p50, p95, p99)
4. **Security**: Failed logins, rate limit hits, suspicious activity
5. **Business KPIs**: Hourly TVL, deposit volume, success rates

### Alerting Rules Summary

| Alert              | Trigger                                | Throttle | Severity |
| ------------------ | -------------------------------------- | -------- | -------- |
| Blockchain Failure | `event.type:deposit.blockchain.failed` | 5m       | Critical |
| Database Down      | `event.type:db.connection.failed`      | 1m       | Critical |
| System Crash       | `event.type:system.crash`              | 0s       | Critical |
| Data Leak          | Unmasked PII detected                  | 0s       | Critical |
| Webhook Failures   | `event.type:webhook.processing.failed` | 5m       | Warning  |
| Rate Limit Hit     | `event.type:rate.limit.hit`            | 10m      | Warning  |

## Security Considerations

### 12-Factor App Compliance

1. **Config**: Environment variables for all configuration
2. **Backing Services**: BetterStack and PostgreSQL treated as attached resources
3. **Statelessness**: Logs written to stdout, not local filesystem
4. **Dev/Prod Parity**: Same logging code in all environments
5. **Logs as Event Streams**: Stdout treated as event stream

### GDPR/CCPA Compliance

- **Data Minimization**: Only log necessary data
- **Right to Erasure**: Can delete user logs via BetterStack API
- **Access Control**: Restricted access to production logs
- **Encryption**: TLS in transit, encrypted at rest (BetterStack)

### PCI DSS Compliance

- **Never Log**: Full PAN, CVV, magnetic stripe data
- **Masking**: Card fingerprints only (last 4 for customer service)
- **Audit Trail**: Complete transaction logs in PostgreSQL
- **Access Logs**: All access to sensitive data logged

## Runbook: Common Scenarios

### Scenario 1: Debugging a Failed Deposit

1. **Find the deposit**: Search BetterStack for `deposit_id: "dep_xxx"`
2. **Check the chain**: Look for `deposit.initiated` → `deposit.stripe.success` → `deposit.blockchain.failed`
3. **Identify failure**: Check `error.code` and `failure_stage`
4. **Deep dive**: Query PostgreSQL audit_logs for full transaction details
5. **Fix**: Address root cause (blockchain congestion, insufficient gas, etc.)

### Scenario 2: Investigating Security Incident

1. **Identify timeframe**: Determine when incident occurred
2. **Search logs**: Query BetterStack for `actor.user_id: "user_xxx"`
3. **Correlate**: Use `correlation_id` to find all related events
4. **Check PostgreSQL**: Cross-reference with audit_logs table
5. **Report**: Document findings, take corrective action

### Scenario 3: Latency Spike

1. **Check metrics**: Review `performance.latency` logs in BetterStack
2. **Identify bottleneck**: Compare `stripe_processing_ms` vs `blockchain_confirmation_ms`
3. **Historical context**: Compare with previous hours/days
4. **Root cause**: Network congestion, gas price spikes, API rate limits
5. **Action**: Implement caching, adjust gas settings, or scale infrastructure

## Future Enhancements (Post-MVP)

1. **Git Commit Hash**: Inject via build-time environment variable
2. **Geolocation**: Add MaxMind GeoIP2 for city-level tracking
3. **Distributed Tracing**: OpenTelemetry integration for microservices
4. **Log Sampling**: 10% sampling for reads in production
5. **Log Signing**: Cryptographic signatures for critical audit events
6. **Metrics Export**: Prometheus/Grafana for real-time dashboards
7. **Mobile Logging**: Pino integration in React Native app

## References

### BetterStack Documentation

- [Logging Best Practices: 12 Dos and Don'ts](https://betterstack.com/community/guides/logging/logging-best-practices/)
- [Log Formatting in Production](https://betterstack.com/community/guides/logging/log-formatting/)
- [Sensitive Data Protection](https://betterstack.com/community/guides/logging/sensitive-data/)
- [Vector Explained](https://betterstack.com/community/guides/logging/vector-explained/)

### OWASP

- [Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)

### Pino

- [Hono Integration](https://getpino.io/#/docs/web?id=hono)
- [API Documentation](https://getpino.io/#/docs/api)
- [pino-http Package](https://www.npmjs.com/package/pino-http)

### Neverthrow

- [GitHub Repository](https://github.com/supermacro/neverthrow)
- [Railway-Oriented Programming](https://fsharpforfunandprofit.com/rop/)

### 12-Factor App

- [Logs as Event Streams](https://12factor.net/logs)

---

## Approval

**Document Version**: 1.0  
**Created**: 2026-02-26  
**Last Updated**: 2026-02-26  
**Status**: Ready for Implementation

**Approved By**: **\*\*\*\***\_**\*\*\*\***  
**Date**: **\*\*\*\***\_**\*\*\*\***

---

## Appendix: Quick Reference

### Critical Event Types

```typescript
const CRITICAL_EVENTS = [
  "system.startup",
  "system.crash",
  "system.shutdown",
  "db.connection.failed",
  "deposit.blockchain.failed",
  "deposit.stripe.failed",
  "encryption.key.error",
  "webhook.processing.failed",
  "auth.system.error",
  "rate.limit.hit",
] as const;
```

### Log Level Guidelines

```typescript
const LOG_LEVELS = {
  TRACE: 10, // Development only - detailed tracing
  DEBUG: 20, // Development only - debugging info
  INFO: 30, // Staging/Prod - significant business events
  WARN: 40, // Abnormal situations (rate limits, retries)
  ERROR: 50, // Unrecoverable errors (alerts triggered)
  FATAL: 60, // System crash (immediate alerts)
} as const;
```

### Redaction Paths

```typescript
const REDACTION_PATHS = [
  // Authentication
  "*.password",
  "*.token",
  "*.secret",
  "headers.authorization",
  "headers.cookie",

  // Crypto
  "*.privateKey",
  "*.mnemonic",
  "*.seedPhrase",

  // Financial
  "*.creditCard",
  "*.cvv",
  "*.bankAccount",

  // PII
  "actor.ip_address", // Country only
  "actor.user_agent", // Not logged
  "context.email", // Masked
  "context.wallet_address", // Not logged
] as const;
```
