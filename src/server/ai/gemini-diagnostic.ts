import "server-only";

const statuses = new Set(["INVALID_ARGUMENT", "UNAUTHENTICATED", "PERMISSION_DENIED", "NOT_FOUND", "RESOURCE_EXHAUSTED", "FAILED_PRECONDITION", "UNAVAILABLE", "INTERNAL"]);
const reasons = new Set(["API_KEY_INVALID", "API_KEY_SERVICE_BLOCKED", "API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED", "API_KEY_EXPIRED", "API_KEY_NOT_FOUND", "ACCESS_TOKEN_TYPE_UNSUPPORTED", "CREDENTIALS_MISSING", "SERVICE_DISABLED", "BILLING_DISABLED"]);
// Exact matches only: never echo arbitrary schema properties, indices or text.
const fields = new Set([
  "model", "contents", "system_instruction", "systemInstruction", "generationConfig", "generation_config",
  "generationConfig.responseFormat", "generationConfig.responseFormat.text",
  "generationConfig.responseFormat.text.mimeType", "generationConfig.responseFormat.text.schema",
  "generationConfig.responseMimeType", "generationConfig.responseJsonSchema",
  "generationConfig.temperature", "generationConfig.candidateCount", "generationConfig.maxOutputTokens",
  "generation_config.response_format", "generation_config.response_format.text",
  "generation_config.response_format.text.mime_type", "generation_config.response_format.text.schema",
  "generation_config.response_mime_type", "generation_config.response_json_schema",
  "generation_config.temperature", "generation_config.candidate_count", "generation_config.max_output_tokens",
]);
// Fixed labels only. The provider sometimes puts argument errors in its message
// rather than google.rpc.BadRequest. Never return that free-form message.
const messageSignals = [
  [/\bexclusiveMinimum\b/, "SCHEMA_EXCLUSIVE_MINIMUM"],
  [/\bminLength\b|\bmaxLength\b/, "SCHEMA_STRING_LENGTH"],
  [/\bresponseFormat\b|\bresponse_format\b/, "RESPONSE_FORMAT_MENTIONED"],
  [/\btemperature\b/i, "TEMPERATURE_MENTIONED"],
  [/\bmaxOutputTokens\b|\bmax_output_tokens\b/, "OUTPUT_LIMIT_MENTIONED"],
  [/\bnot supported\b|\bunsupported\b/i, "UNSUPPORTED_ARGUMENT_MENTIONED"],
  [/\bunknown name\b|\bunknown field\b/i, "UNKNOWN_FIELD_MENTIONED"],
] as const;

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
  if (typeof error.message === "string") {
    for (const [pattern, label] of messageSignals) if (pattern.test(error.message.slice(0, 4096))) result.reasons.push(label);
  }
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
