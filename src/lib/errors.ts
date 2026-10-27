export const errorMessages = {
  INVALID_JSON: "The request body is not valid JSON.",
  VALIDATION_FAILED: "Check the supplied fields.",
  AUTH_REQUIRED: "Sign in to continue.",
  EMAIL_NOT_CONFIRMED: "Your email address is not confirmed yet. Open the confirmation email we sent you, or request another from the Create account page.",
  MFA_REQUIRED: "Verify your authenticator code to continue.",
  ACTION_FORBIDDEN: "This action is not available.",
  WRONG_ORIGIN: "This is not the official address of this ORYQEN environment, so sign-in and saving are blocked here. Open the official address and try again.",
  WEAK_PASSWORD: "That password was refused as too easy to guess or too commonly used. Choose a longer, less common password.",
  SAME_PASSWORD: "Choose a password that is different from your current one.",
  RESET_EXPIRED: "Your password-reset session has expired. Request a new reset email.",
  NOT_FOUND: "The requested record is not available.",
  VERSION_CONFLICT: "This record changed. Reload before trying again.",
  IDEMPOTENCY_CONFLICT: "Use a new request key for changed input.",
  PAYLOAD_TOO_LARGE: "The request is too large.",
  UNSUPPORTED_MEDIA_TYPE: "Send a JSON request.",
  RATE_LIMITED: "Too many requests. Try again shortly.",
  SERVICE_UNAVAILABLE: "This service is not available. Try again later.",
  INTERNAL_ERROR: "Something went wrong. Try again later.",
} as const;
export type ErrorCode = keyof typeof errorMessages;
export class AppError extends Error {
  constructor(public readonly code: ErrorCode, public readonly status: number) { super(errorMessages[code]); }
}

export function mapDatabaseError(error: { code?: string; message?: string }): AppError {
  // Only controlled tokens, never provider messages, reach the client.
  const known: Partial<Record<string, [ErrorCode, number]>> = {
    AUTH_REQUIRED: ["AUTH_REQUIRED", 401], ACTION_FORBIDDEN: ["ACTION_FORBIDDEN", 403],
    MFA_REQUIRED: ["MFA_REQUIRED", 403],
    NOT_FOUND: ["NOT_FOUND", 404], VALIDATION_FAILED: ["VALIDATION_FAILED", 422],
    VERSION_CONFLICT: ["VERSION_CONFLICT", 409], IDEMPOTENCY_CONFLICT: ["IDEMPOTENCY_CONFLICT", 409],
    RATE_LIMITED: ["RATE_LIMITED", 429],
  };
  const match = error.message ? known[error.message] : undefined;
  if (match) return new AppError(...match);
  if (error.code === "42501") return new AppError("ACTION_FORBIDDEN", 403);
  return new AppError("SERVICE_UNAVAILABLE", 503);
}
