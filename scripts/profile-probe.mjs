// A profile/RPC failure is not evidence that a browser lost its session cookie.
// Return only allowlisted diagnostics, never response messages, DTOs or tokens.
export function profileProbe(response) {
  const codes = ["AUTH_REQUIRED", "ACTION_FORBIDDEN", "NOT_FOUND", "SERVICE_UNAVAILABLE", "INTERNAL_ERROR", "RATE_LIMITED", "VALIDATION_FAILED"];
  const code = codes.includes(response.data?.error?.code) ? response.data.error.code : "OTHER";
  const status = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : 0;
  return {
    available: status === 200 || (status === 404 && code === "NOT_FOUND"),
    note: `HTTP ${status}; application code ${code}`,
  };
}
