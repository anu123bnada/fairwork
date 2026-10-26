import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

// Private object storage for Evidence Vault files. Two implementations of one interface:
//  - Supabase Storage (hosted): a private bucket reached only by the server with a server-only secret. Clients never
//    receive a storage credential, only a short-lived signed URL after the database has authorised the owner.
//  - Local disk (development and tests only): refused unless the app origin is a loopback address.
export interface BlobStore {
  readonly kind: "supabase" | "local";
  put(key: string, bytes: Uint8Array, mediaType: string): Promise<void>;
  remove(key: string): Promise<void>;
  signedUrl(key: string, fileName: string, mediaType: string, seconds: number): Promise<{ url: string; expiresAt: string }>;
}

// '<owner uuid>/<document uuid>' and nothing else: no traversal, no extra segments.
export const storageKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
function assertKey(key: string) { if (!storageKeyPattern.test(key)) throw new Error("invalid storage key"); }
const b64 = (value: Buffer | string) => Buffer.from(value).toString("base64url");

const tokenPayload = z.strictObject({ k: z.string(), f: z.string(), m: z.string(), e: z.number() });

export function localStore(directory: string, origin: string, secret: string = randomBytes(32).toString("hex")): BlobStore & { read(token: string, now?: number): Promise<{ bytes: Buffer; fileName: string; mediaType: string } | null> } {
  const root = path.resolve(directory);
  const target = (key: string) => { assertKey(key); const file = path.resolve(root, key); if (!file.startsWith(root + path.sep)) throw new Error("invalid storage key"); return file; };
  const sign = (body: string) => createHmac("sha256", secret).update(body).digest();
  return {
    kind: "local",
    async put(key, bytes) { const file = target(key); await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, bytes); },
    async remove(key) { await rm(target(key), { force: true }); },
    async signedUrl(key, fileName, mediaType, seconds) {
      assertKey(key);
      const expires = Date.now() + seconds * 1000;
      const body = b64(JSON.stringify({ k: key, f: fileName, m: mediaType, e: expires }));
      return { url: `${origin}/api/v1/vault/blob?token=${body}.${b64(sign(body))}`, expiresAt: new Date(expires).toISOString() };
    },
    async read(token, now = Date.now()) {
      const [body, signature, extra] = token.split(".");
      if (!body || !signature || extra !== undefined) return null;
      const expected = sign(body), given = Buffer.from(signature, "base64url");
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
      let payload; try { payload = tokenPayload.parse(JSON.parse(Buffer.from(body, "base64url").toString("utf8"))); } catch { return null; }
      if (payload.e <= now || !storageKeyPattern.test(payload.k)) return null;
      try { return { bytes: await readFile(target(payload.k)), fileName: payload.f, mediaType: payload.m }; } catch { return null; }
    },
  };
}

export function supabaseStore(baseUrl: string, serviceKey: string, bucket: string, fetcher: typeof fetch = fetch): BlobStore {
  const base = baseUrl.replace(/\/+$/, "");
  const object = (key: string) => { assertKey(key); return `${base}/storage/v1/object/${encodeURIComponent(bucket)}/${key}`; };
  const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey };
  const call = async (url: string, init: RequestInit) => { const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(20000) }); if (!response.ok) throw new Error(`storage ${response.status}`); return response; };
  return {
    kind: "supabase",
    async put(key, bytes, mediaType) { await call(object(key), { method: "POST", headers: { ...headers, "Content-Type": mediaType, "x-upsert": "true", "Cache-Control": "private, max-age=0" }, body: bytes as BodyInit }); },
    async remove(key) { assertKey(key); const response = await fetcher(object(key), { method: "DELETE", headers, signal: AbortSignal.timeout(20000) }); if (!response.ok && response.status !== 404) throw new Error(`storage ${response.status}`); },
    async signedUrl(key, fileName, _mediaType, seconds) {
      assertKey(key);
      const response = await call(`${base}/storage/v1/object/sign/${encodeURIComponent(bucket)}/${key}`, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify({ expiresIn: seconds }) });
      const parsed = z.object({ signedURL: z.string().startsWith("/") }).parse(await response.json());
      return { url: `${base}/storage/v1${parsed.signedURL}&download=${encodeURIComponent(fileName)}`, expiresAt: new Date(Date.now() + seconds * 1000).toISOString() };
    },
  };
}

const loopback = (origin: string) => { try { return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(origin).hostname); } catch { return false; } };

// Chooses the store from configuration. Returns null when nothing is configured, and the caller reports that honestly.
export type LocalBlobStore = ReturnType<typeof localStore>;
export const isLocalStore = (store: BlobStore): store is LocalBlobStore => store.kind === "local" && "read" in store;
let cachedLocal: LocalBlobStore | null = null;
export function vaultStoreFromEnv(origin: string, env: Record<string, string | undefined> = process.env): BlobStore | null {
  const url = env.ORYQEN_VAULT_STORAGE_URL?.trim(), key = env.ORYQEN_VAULT_STORAGE_SERVICE_KEY?.trim();
  if (url && key) {
    if (!/^https:\/\//.test(url) && !loopback(url)) return null;
    return supabaseStore(url, key, env.ORYQEN_VAULT_BUCKET?.trim() || "evidence-vault");
  }
  const directory = env.ORYQEN_VAULT_LOCAL_DIR?.trim();
  if (directory && loopback(origin)) { cachedLocal ??= localStore(directory, origin, env.ORYQEN_VAULT_LOCAL_SECRET?.trim() || undefined); return cachedLocal; }
  return null;
}
