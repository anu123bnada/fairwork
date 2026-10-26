import "server-only";

// Every way a provider call can fail, classified without copying any provider text (which can contain user input or credentials).
//  quota        the provider says the account is out of quota or rate limited (HTTP 429)
//  configuration the key, project or request was rejected (HTTP 400, 401, 403)
//  model        the model or resource does not exist for this account (HTTP 404)
//  unavailable  the provider had a transient server fault (HTTP 500, 502, 503, 504, 529)
//  network      the connection failed before an answer arrived
//  timeout      no answer within the allowed time (the request may still be processing, so it is not retried automatically)
//  incomplete   the output hit its token limit
//  blocked      the provider declined or filtered the request
//  invalid      the answer was malformed, ungrounded or failed validation
//  budget       the local usage budget for this provider is exhausted (no request was sent)
export type FailureKind = "quota" | "configuration" | "model" | "unavailable" | "network" | "timeout" | "incomplete" | "blocked" | "invalid" | "budget";

export class ProviderFailure extends Error {
  constructor(readonly kind: FailureKind, readonly retryAfterSeconds: number | null = null) { super(kind); }
}

// Transient faults are the only failures retried automatically, and only within the one consented request.
export const retryable = (kind: FailureKind) => kind === "unavailable" || kind === "network";

// A provider's own pause hint: the Retry-After header (seconds or a date) or Google's RetryInfo detail ("34s", "1.5s").
export function retryAfterFrom(headers: Headers | null, body: unknown, now = Date.now()): number | null {
  const header = headers?.get("retry-after");
  if (header) {
    if (/^\d{1,7}$/.test(header.trim())) return Number(header);
    // Only a real HTTP-date counts; a negative or garbled number must not parse as an ancient date.
    const at = /[A-Za-z]{3}/.test(header) ? Date.parse(header) : Number.NaN;
    if (!Number.isNaN(at)) return Math.max(0, Math.ceil((at - now) / 1000));
  }
  const error = body && typeof body === "object" ? (body as { error?: { details?: unknown } }).error : undefined;
  if (Array.isArray(error?.details)) {
    for (const detail of error.details.slice(0, 32)) {
      const record = detail as { "@type"?: unknown; retryDelay?: unknown };
      if (record?.["@type"] === "type.googleapis.com/google.rpc.RetryInfo" && typeof record.retryDelay === "string") {
        const match = /^(\d{1,7}(?:\.\d{1,3})?)s$/.exec(record.retryDelay);
        if (match) return Math.ceil(Number(match[1]));
      }
    }
  }
  return null;
}

export function classifyHttpStatus(status: number): FailureKind | null {
  if (status >= 200 && status < 300) return null;
  if (status === 429) return "quota";
  if (status === 400 || status === 401 || status === 403) return "configuration";
  if (status === 404) return "model";
  if ([500, 502, 503, 504, 529].includes(status)) return "unavailable";
  return "invalid";
}

export function classifyThrown(error: unknown): FailureKind {
  if (error instanceof ProviderFailure) return error.kind;
  if (error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name)) return "timeout";
  if (error instanceof TypeError) return "network"; // fetch rejects with TypeError when the connection fails
  return "invalid";
}
