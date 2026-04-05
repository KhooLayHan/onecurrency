import { StatusCodes } from "http-status-codes";
import { AppError } from "./base";

/**
 * Thrown when a user cannot be found by ID, email, or wallet address.
 */
export class UserNotFoundError extends AppError {
  readonly code = "USER_NOT_FOUND";
  readonly statusCode = StatusCodes.NOT_FOUND;
  readonly domain = "user" as const;
  readonly severity = "low" as const;
  readonly isOperational = true;

  constructor(
    identifier: string,
    options?: ConstructorParameters<typeof AppError>[1]
  ) {
    super(`User '${identifier}' was not found.`, {
      ...options,
      context: { identifier, ...options?.context },
    });
  }
}
