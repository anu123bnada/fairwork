import "server-only";
import { createHash } from "node:crypto";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { checkVaultFile, vaultDeleted, vaultFetched, vaultListResponse, vaultRegistered, vaultUploadFields } from "@/features/vault/schema";
import type { z } from "zod";
import type { BlobStore } from "./store";

type Rpc = (name: string, request: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
export type VaultDeps = { rpc: Rpc; store: BlobStore | null; userId: string };

const need = (store: BlobStore | null) => { if (!store) throw new AppError("SERVICE_UNAVAILABLE", 503); return store; };
async function call<T>(deps: VaultDeps, name: string, request: Record<string, unknown>, schema: z.ZodType<T>): Promise<T> {
  const { data, error } = await deps.rpc(name, request);
  if (error) throw mapDatabaseError(error);
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}

// The document id is the idempotency key, so a retry of the same upload addresses the same stored object.
// Metadata is registered first (the database enforces ownership, key shape, limits and replay), then the bytes are
// stored; if storing fails a fresh registration is rolled back so no document is listed without its file.
export async function uploadDocument(input: { bytes: Uint8Array; declaredType: string; declaredName: string; fields: z.infer<typeof vaultUploadFields> }, deps: VaultDeps) {
  const store = need(deps.store);
  const checked = checkVaultFile(input.bytes, input.declaredType, input.declaredName);
  if (!checked.ok) throw checked.reason === "too_large" ? new AppError("PAYLOAD_TOO_LARGE", 413) : new AppError("UNSUPPORTED_MEDIA_TYPE", 415);
  const documentId = input.fields.idempotencyKey;
  const storageKey = `${deps.userId}/${documentId}`;
  const sha256 = createHash("sha256").update(input.bytes).digest("hex");
  const registered = await call(deps, "vault_register", { documentId, title: input.fields.title, category: input.fields.category, fileName: checked.fileName, mediaType: checked.mediaType, byteSize: input.bytes.byteLength, sha256, storageKey, idempotencyKey: input.fields.idempotencyKey }, vaultRegistered);
  try { await store.put(storageKey, input.bytes, checked.mediaType); }
  catch {
    if (!registered.replayed) await deps.rpc("vault_delete", { documentId }).catch(() => undefined);
    throw new AppError("SERVICE_UNAVAILABLE", 503);
  }
  return { documentId, replayed: registered.replayed, fileName: checked.fileName, mediaType: checked.mediaType, byteSize: input.bytes.byteLength, sha256 };
}

export async function listDocuments(deps: VaultDeps) {
  const list = await call(deps, "vault_list", {}, vaultListResponse);
  return { ...list, storageConfigured: deps.store !== null };
}

// Authorised by the database (owner only), then a short-lived signed URL. The application never serves the bytes inline.
export async function documentLink(documentId: string, deps: VaultDeps, seconds = 60) {
  const store = need(deps.store);
  const document = await call(deps, "vault_fetch", { documentId }, vaultFetched);
  return store.signedUrl(document.storageKey, document.fileName, document.mediaType, seconds);
}

export async function deleteDocument(documentId: string, deps: VaultDeps) {
  const removed = await call(deps, "vault_delete", { documentId }, vaultDeleted);
  let fileRemoved = false;
  if (deps.store) { try { await deps.store.remove(removed.storageKey); fileRemoved = true; } catch { fileRemoved = false; } }
  return { documentId: removed.documentId, fileRemoved };
}
