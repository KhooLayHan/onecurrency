/**
 * compliance.ts
 *
 * Compliance, KYC & AML errors.
 * Covers identity verification, sanctions screening, and jurisdiction restrictions.
 */

import { StatusCodes } from "http-status-codes";
import { AppError } from "./base";

/**
 * Thrown when a user has not completed KYC and the requested action requires it.
 */
export class KycRequiredError extends AppError {
  readonly code = "COMPLIANCE_KYC_REQUIRED";
  readonly statusCode = StatusCodes.FORBIDDEN;
  readonly domain = "compliance" as const;
  readonly severity = "medium" as const;
  readonly isOperational = true;

  constructor(
    requiredTier: "basic" | "enhanced" | "institutional",
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `This action requires ${requiredTier} KYC verification. Please complete identity verification to proceed.`,
      {
        ...options,
        context: { requiredTier, ...options?.context },
      }
    );
  }
}

/**
 * Thrown when a KYC check is still in progress.
 */
export class KycPendingError extends AppError {
  readonly code = "COMPLIANCE_KYC_PENDING";
  readonly statusCode = StatusCodes.CONFLICT;
  readonly domain = "compliance" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;
  override readonly retryable = true;

  constructor(
    submittedAt: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      `KYC verification is still in progress (submitted: ${submittedAt}). Please check back shortly.`,
      {
        ...options,
        context: { submittedAt, ...options?.context },
      }
    );
  }
}

/**
 * Thrown when a wallet address is on a sanctions list (OFAC, EU, UN).
 */
export class SanctionedAddressError extends AppError {
  readonly code = "COMPLIANCE_ADDRESS_SANCTIONED";
  readonly statusCode = StatusCodes.FORBIDDEN;
  readonly domain = "compliance" as const;
  readonly severity = "critical" as const;
  readonly isOperational = true;

  constructor(options?: ConstructorParameters<typeof AppError>[1]) {
    // Deliberately vague — do not confirm which list or specific address
    super(
      "This transaction cannot be processed due to compliance restrictions.",
      options
    );
  }
}

/**
 * Thrown when a transaction is flagged by AML screening.
 */
export class AmlFlaggedError extends AppError {
  readonly code = "COMPLIANCE_AML_FLAGGED";
  readonly statusCode = StatusCodes.FORBIDDEN;
  readonly domain = "compliance" as const;
  readonly severity = "critical" as const;
  readonly isOperational = true;

  constructor(
    reviewId: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(
      "This transaction has been flagged for manual review and cannot be processed at this time.",
      {
        ...options,
        context: { reviewId, ...options?.context },
      }
    );
  }
}

/**
 * Thrown when a transaction originates from or is destined for a restricted jurisdiction.
 */
export class RestrictedJurisdictionError extends AppError {
  readonly code = "COMPLIANCE_RESTRICTED_JURISDICTION";
  readonly statusCode = StatusCodes.UNAVAILABLE_FOR_LEGAL_REASONS;
  readonly domain = "compliance" as const;
  readonly severity = "high" as const;
  readonly isOperational = true;

  constructor(options?: ConstructorParameters<typeof AppError>[1]) {
    super("This service is not available in your jurisdiction.", options);
  }
}

/**
 * Thrown when a user tries to submit KYC but their verification is already approved.
 */
export class KycAlreadyVerifiedError extends AppError {
  readonly code = "COMPLIANCE_KYC_ALREADY_VERIFIED";
  readonly statusCode = StatusCodes.CONFLICT;
  readonly domain = "compliance" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(options?: ConstructorParameters<typeof AppError>[1]) {
    super(
      "Your identity has already been verified. No further action is needed.",
      options
    );
  }
}
