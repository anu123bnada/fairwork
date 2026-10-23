import "server-only";

const statuses = new Set(["INVALID_ARGUMENT", "UNAUTHENTICATED", "PERMISSION_DENIED", "NOT_FOUND", "RESOURCE_EXHAUSTED", "FAILED_PRECONDITION", "UNAVAILABLE", "INTERNAL"]);
const reasons = new Set(["API_KEY_INVALID", "API_KEY_SERVICE_BLOCKED", "API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED", "API_KEY_EXPIRED", "API_KEY_NOT_FOUND", "ACCESS_TOKEN_TYPE_UNSUPPORTED", "CREDENTIALS_MISSING", "SERVICE_DISABLED", "BILLING_DISABLED"]);
// Exact matches only: never echo arbitrary schema properties, indices or text.
const fields = new Set([
  "model", "contents", "system_instruction", "systemInstruction", "generationConfig", "generation_config",
  "generationConfig.responseFormat", "generationConfig.responseFormat.text",
  "generationConfig.responseFormat.text.mimeType", "generationConfig.responseFormat.text.schema",
  "generationConfig.temperature", "generationConfig.candidateCount", "generationConfig.maxOutputTokens",
  "generation_config.response_format", "generation_config.response_format.text",
  "generation_config.response_format.text.mime_type", "generation_config.response_format.text.schema",
  "generation_config.temperature", "generation_config.candidate_count", "generation_config.max_output_tokens",
]);

export type GeminiDiagnostic = { status: string | null; reasons: string[]; fields: string[] };
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

// Input has already been byte-bounded and JSON-parsed. No message/description,
// metadata or raw response is returned, logged or persisted. Unknown means unknown.
export function sanitizeGeminiDiagnostic(value: unknown): GeminiDiagnostic {
  const result: GeminiDiagnostic = { status: null, reasons: [], fields: [] };
  const error = object(object(value)?.error);
  if (!error) return result;
  if (typeof error.status === "string" && statuses.has(error.status)) result.status = error.status;
  if (!Array.isArray(error.details)) return result;
  for (const raw of error.details.slice(0, 32)) {
    const detail = object(raw);
    if (detail?.["@type"] === "type.googleapis.com/google.rpc.ErrorInfo" && typeof detail.reason === "string" && reasons.has(detail.reason)) result.reasons.push(detail.reason);
    if (detail?.["@type"] !== "type.googleapis.com/google.rpc.BadRequest" || !Array.isArray(detail.fieldViolations)) continue;
    for (const rawViolation of detail.fieldViolations.slice(0, 32)) {
      const field = object(rawViolation)?.field;
      if (typeof field === "string" && fields.has(field)) result.fields.push(field);
    }
  }
  return { status: result.status, reasons: [...new Set(result.reasons)], fields: [...new Set(result.fields)] };
}
