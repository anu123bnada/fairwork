import { errorMessages, type ErrorCode } from "@/lib/errors";
import { translate, type MessageKey } from "@/i18n";
import { readStoredLocale } from "@/i18n/use-i18n";

// Server messages are plain English; in the browser the same text is shown in the person's language by error code, falling back to English.
const messageFor = (code: ErrorCode) => { const key = `err.${code}` as MessageKey; const shown = translate(readStoredLocale(), key); return shown && shown !== key ? shown : errorMessages[code]; };

export class ApiRequestError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
  ) {
    super(messageFor(code));
    this.name = "ApiRequestError";
  }
}

export async function appRequest(path: string, body?: unknown, key?: string, method: "POST" | "PATCH" = "POST") {
  let response: Response;
  try { response = await fetch(path, {
    method: body === undefined ? "GET" : method, cache: "no-store", credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  }); } catch {
    // A lost response does not establish whether a write committed. Callers
    // retain their idempotency key and explicitly retry the same operation.
    throw new ApiRequestError("SERVICE_UNAVAILABLE", 503);
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) {
    const rawCode = result?.error?.code as ErrorCode;
    const code = Object.hasOwn(errorMessages, rawCode) ? rawCode : response.status >= 500 ? "SERVICE_UNAVAILABLE" : "INTERNAL_ERROR";
    throw new ApiRequestError(code, response.status);
  }
  if (!result || typeof result !== "object" || !Object.hasOwn(result, "data")) {
    throw new ApiRequestError("SERVICE_UNAVAILABLE", 503);
  }
  return result.data;
}
