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
  const response = await fetch(path, {
    method: body === undefined ? "GET" : method, cache: "no-store", credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) {
    const rawCode = result?.error?.code as ErrorCode;
    const code = Object.hasOwn(errorMessages, rawCode) ? rawCode : "INTERNAL_ERROR";
    throw new ApiRequestError(code, response.status);
  }
  return result.data;
}
