import { errorMessages, type ErrorCode } from "@/lib/errors";

export class ApiRequestError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
  ) {
    super(errorMessages[code]);
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
