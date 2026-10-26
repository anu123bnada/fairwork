import { apiResponse, assertSameOrigin } from "@/server/http";
import { vaultContext } from "@/server/vault/context";
import { listDocuments, uploadDocument } from "@/server/vault/service";
import { vaultLimits, vaultUploadFields } from "@/features/vault/schema";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiResponse(async () => {
    if ([...new URL(request.url).searchParams.keys()].length) throw new AppError("VALIDATION_FAILED", 422);
    return listDocuments(await vaultContext());
  }, "vault.v1");
}

// Reads at most the allowed size from the stream before parsing, so an oversized upload is refused without buffering it all.
async function readCapped(request: Request, limit: number) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw new AppError("PAYLOAD_TOO_LARGE", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("VALIDATION_FAILED", 422);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new AppError("PAYLOAD_TOO_LARGE", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.split(";")[0]?.trim() !== "multipart/form-data") throw new AppError("UNSUPPORTED_MEDIA_TYPE", 415);
    const deps = await vaultContext();
    const body = await readCapped(request, vaultLimits.maxBytes + 64 * 1024);
    let form: FormData;
    try { form = await new Response(body, { headers: { "content-type": contentType } }).formData(); }
    catch { throw new AppError("VALIDATION_FAILED", 422); }
    const file = form.get("file");
    if (!(file instanceof File) || [...form.keys()].some(key => !["file", "title", "category", "idempotencyKey"].includes(key))) throw new AppError("VALIDATION_FAILED", 422);
    const fields = vaultUploadFields.safeParse({ title: form.get("title"), category: form.get("category"), idempotencyKey: form.get("idempotencyKey") });
    if (!fields.success) throw new AppError("VALIDATION_FAILED", 422);
    const result = await uploadDocument({ bytes: new Uint8Array(await file.arrayBuffer()), declaredType: file.type, declaredName: file.name, fields: fields.data }, deps);
    return result;
  }, "vault.v1");
}
