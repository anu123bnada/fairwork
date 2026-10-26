import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { createHash } from "node:crypto";
import { deleteDocument, documentLink, listDocuments, uploadDocument } from "@/server/vault/service";
import type { BlobStore } from "@/server/vault/store";

const owner = "40000000-0000-4000-8000-000000000001", key = "50000000-0000-4000-8000-000000000002";
const pdf = new TextEncoder().encode("%PDF-1.7 synthetic certificate");
const fields = { title: "Welding certificate", category: "certificate" as const, idempotencyKey: key };

function fakeStore(overrides: Partial<BlobStore> = {}): BlobStore & { puts: string[]; removed: string[] } {
  const puts: string[] = [], removed: string[] = [];
  return { kind: "local", puts, removed,
    put: async k => { puts.push(k); }, remove: async k => { removed.push(k); },
    signedUrl: async (k, name) => ({ url: `https://signed.example.test/${k}?name=${name}`, expiresAt: "2026-10-27T00:00:00Z" }), ...overrides };
}
const ok = (data: unknown) => ({ data, error: null });

describe("vault service", () => {
  it("registers metadata bound to the caller, then stores the verified bytes under <owner>/<document>", async () => {
    const store = fakeStore(); const rpc = vi.fn(async () => ok({ documentId: key, replayed: false }));
    const result = await uploadDocument({ bytes: pdf, declaredType: "application/pdf", declaredName: "../Cert.pdf", fields }, { rpc, store, userId: owner });
    expect(rpc).toHaveBeenCalledWith("vault_register", { documentId: key, title: "Welding certificate", category: "certificate", fileName: "Cert.pdf", mediaType: "application/pdf", byteSize: pdf.byteLength, sha256: createHash("sha256").update(pdf).digest("hex"), storageKey: `${owner}/${key}`, idempotencyKey: key });
    expect(store.puts).toEqual([`${owner}/${key}`]);
    expect(result).toMatchObject({ documentId: key, replayed: false, fileName: "Cert.pdf" });
  });

  it("refuses a bad file before touching the database or the store", async () => {
    const store = fakeStore(); const rpc = vi.fn();
    const attempt = (bytes: Uint8Array, type = "application/pdf") => uploadDocument({ bytes, declaredType: type, declaredName: "x.pdf", fields }, { rpc, store, userId: owner });
    await expect(attempt(Uint8Array.from([0x4d, 0x5a, 1, 2]))).rejects.toMatchObject({ status: 415 });
    await expect(attempt(pdf, "image/png")).rejects.toMatchObject({ status: 415 });
    await expect(attempt(new Uint8Array(5 * 1024 * 1024 + 1))).rejects.toMatchObject({ status: 413 });
    expect(rpc).not.toHaveBeenCalled(); expect(store.puts).toEqual([]);
  });

  it("is unavailable, not silently local, when no store is configured", async () => {
    await expect(uploadDocument({ bytes: pdf, declaredType: "application/pdf", declaredName: "x.pdf", fields }, { rpc: vi.fn(), store: null, userId: owner })).rejects.toMatchObject({ status: 503 });
    expect(await listDocuments({ rpc: async () => ok({ items: [], limit: 50, used: 0 }), store: null, userId: owner })).toMatchObject({ storageConfigured: false });
  });

  it("rolls back a fresh registration when the file cannot be stored, but leaves a replayed one alone", async () => {
    const broken = fakeStore({ put: async () => { throw new Error("down"); } });
    const rpc = vi.fn(async (name: string) => name === "vault_register" ? ok({ documentId: key, replayed: false }) : ok({}));
    await expect(uploadDocument({ bytes: pdf, declaredType: "application/pdf", declaredName: "x.pdf", fields }, { rpc, store: broken, userId: owner })).rejects.toMatchObject({ status: 503 });
    expect(rpc).toHaveBeenLastCalledWith("vault_delete", { documentId: key });
    const replay = vi.fn(async () => ok({ documentId: key, replayed: true }));
    await expect(uploadDocument({ bytes: pdf, declaredType: "application/pdf", declaredName: "x.pdf", fields }, { rpc: replay, store: broken, userId: owner })).rejects.toMatchObject({ status: 503 });
    expect(replay).toHaveBeenCalledTimes(1);
  });

  it("returns a signed link only for a document the database releases, and treats a malformed reply as unavailable", async () => {
    const store = fakeStore();
    const rpc = vi.fn(async () => ok({ documentId: key, storageKey: `${owner}/${key}`, fileName: "Cert.pdf", mediaType: "application/pdf" }));
    expect((await documentLink(key, { rpc, store, userId: owner })).url).toBe(`https://signed.example.test/${owner}/${key}?name=Cert.pdf`);
    const missing = async () => ({ data: null, error: { message: "NOT_FOUND", code: "P0001" } });
    await expect(documentLink(key, { rpc: missing, store, userId: owner })).rejects.toMatchObject({ status: 404 });
    await expect(documentLink(key, { rpc: async () => ok({ documentId: key, storageKey: "x", extra: 1 }), store, userId: owner })).rejects.toMatchObject({ status: 503 });
  });

  it("deletes the record first, then the file, and reports honestly when the file removal failed", async () => {
    const store = fakeStore();
    const rpc = async () => ok({ documentId: key, storageKey: `${owner}/${key}` });
    expect(await deleteDocument(key, { rpc, store, userId: owner })).toEqual({ documentId: key, fileRemoved: true });
    expect(store.removed).toEqual([`${owner}/${key}`]);
    const failing = fakeStore({ remove: async () => { throw new Error("down"); } });
    expect(await deleteDocument(key, { rpc, store: failing, userId: owner })).toEqual({ documentId: key, fileRemoved: false });
  });
});
