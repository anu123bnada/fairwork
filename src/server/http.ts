import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getServerEnvironment } from "@/server/env";
import {recordRuntimeEvent} from "@/server/telemetry";

export function assertSameOrigin(request: Request) {
  if (request.headers.get("origin") !== getServerEnvironment().origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new AppError("ACTION_FORBIDDEN", 403);
  }
}
export async function readJson<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw new AppError("UNSUPPORTED_MEDIA_TYPE", 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("INVALID_JSON", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65536) { await reader.cancel(); throw new AppError("PAYLOAD_TOO_LARGE", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let data: unknown;
  try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AppError("INVALID_JSON", 400); }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AppError("VALIDATION_FAILED", 422);
  return parsed.data;
}
export async function apiResponse(action: (requestId: string) => Promise<unknown>, schemaVersion = "identity.v1") {
  const requestId = crypto.randomUUID();
  const headers: Record<string, string> = { "Cache-Control": "private, no-store", "X-Request-Id": requestId };
  try { return Response.json({ data: await action(requestId), meta: { requestId, schemaVersion } }, { headers }); }
  catch (error) {
    const safe = error instanceof AppError ? error : new AppError("INTERNAL_ERROR", 500);
    await recordRuntimeEvent({id:requestId,kind:"api_failure",operation:schemaVersion,code:safe.code});
    // No request body, email, token, provider message or stack in ordinary logs.
    if (safe.status >= 500) console.error(JSON.stringify({ requestId, code: safe.code }));
    if (safe.status === 429) headers["Retry-After"] = "60";
    return Response.json({ error: { code: safe.code, message: safe.message }, meta: { requestId } }, { status: safe.status, headers });
  }
}
export function idempotencyKey(request: Request) {
  const result = z.uuid().safeParse(request.headers.get("idempotency-key"));
  if (!result.success) throw new AppError("VALIDATION_FAILED", 422);
  return result.data;
}
