import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { localStore, storageKeyPattern, supabaseStore, vaultStoreFromEnv } from "@/server/vault/store";

const owner = "40000000-0000-4000-8000-000000000001", doc = "50000000-0000-4000-8000-000000000002";
const key = `${owner}/${doc}`;
const origin = "http://localhost:3000";

describe("local vault store", () => {
  it("stores bytes privately and serves them only through an unexpired, untampered signed token", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vault-"));
    try {
      const store = localStore(dir, origin, "test-secret");
      await store.put(key, Buffer.from("%PDF-1.7 hello"), "application/pdf");
      const { url, expiresAt } = await store.signedUrl(key, "Pay slip.pdf", "application/pdf", 60);
      expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
      const token = new URL(url).searchParams.get("token")!;
      expect((await store.read(token))?.bytes.toString()).toBe("%PDF-1.7 hello");
      expect(await store.read(token, Date.now() + 61_000)).toBeNull();
      const [body, signature] = token.split(".");
      const forged = Buffer.from(JSON.stringify({ k: `${doc}/${owner}`, f: "x.pdf", m: "application/pdf", e: Date.now() + 60_000 })).toString("base64url");
      expect(await store.read(`${forged}.${signature}`)).toBeNull();
      expect(await store.read(`${body}.${signature!.slice(0, -2)}AA`)).toBeNull();
      expect(await store.read("garbage")).toBeNull();
      expect(await localStore(dir, origin, "another-secret").read(token)).toBeNull();
      await store.remove(key); expect(await store.read(token)).toBeNull();
      await store.remove(key); // removing twice is fine
    } finally { await rm(dir, { recursive: true, force: true }); }
  });

  it("refuses keys that are not <owner>/<document> and never writes outside its directory", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "vault-"));
    try {
      const store = localStore(dir, origin);
      for (const bad of ["../escape", `${owner}/../../x`, `${owner}/${doc}/extra`, "plain", `${owner}\${doc}`, ""]) await expect(store.put(bad, Buffer.from("x"), "application/pdf")).rejects.toThrow();
      expect(storageKeyPattern.test(key)).toBe(true);
      expect(await readdir(dir)).toEqual([]);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
});

describe("supabase vault store", () => {
  it("uses the private bucket with the server secret and returns a signed download URL", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => { calls.push({ url: String(url), init: init ?? {} }); return Response.json({ signedURL: "/object/sign/evidence-vault/x?token=abc" }); }) as unknown as typeof fetch;
    const store = supabaseStore("https://project.example.test/", "server-secret", "evidence-vault", fetcher);
    await store.put(key, Buffer.from("x"), "application/pdf");
    expect(calls[0]).toMatchObject({ url: `https://project.example.test/storage/v1/object/evidence-vault/${key}` });
    expect((calls[0]!.init.headers as Record<string, string>).Authorization).toBe("Bearer server-secret");
    const signed = await store.signedUrl(key, "Pay slip.pdf", "application/pdf", 60);
    expect(signed.url).toBe("https://project.example.test/storage/v1/object/sign/evidence-vault/x?token=abc&download=Pay%20slip.pdf");
    expect(JSON.parse(String(calls[1]!.init.body))).toEqual({ expiresIn: 60 });
    await expect(store.put("../x", Buffer.from("x"), "application/pdf")).rejects.toThrow();
  });

  it("treats a missing object as already removed but surfaces other failures", async () => {
    const status = (code: number) => (async () => new Response(null, { status: code })) as unknown as typeof fetch;
    await expect(supabaseStore("https://p.example.test", "k", "b", status(404)).remove(key)).resolves.toBeUndefined();
    await expect(supabaseStore("https://p.example.test", "k", "b", status(500)).remove(key)).rejects.toThrow();
    await expect(supabaseStore("https://p.example.test", "k", "b", status(403)).put(key, Buffer.from("x"), "image/png")).rejects.toThrow();
  });
});

describe("store selection", () => {
  it("is unconfigured by default and never uses local disk on a non-loopback origin", () => {
    expect(vaultStoreFromEnv(origin, {})).toBeNull();
    expect(vaultStoreFromEnv("https://app.example.test", { ORYQEN_VAULT_LOCAL_DIR: "C:/vault" })).toBeNull();
    expect(vaultStoreFromEnv(origin, { ORYQEN_VAULT_STORAGE_URL: "http://storage.example.test", ORYQEN_VAULT_STORAGE_SERVICE_KEY: "k" })).toBeNull();
    expect(vaultStoreFromEnv(origin, { ORYQEN_VAULT_STORAGE_URL: "https://storage.example.test", ORYQEN_VAULT_STORAGE_SERVICE_KEY: "k" })?.kind).toBe("supabase");
    expect(vaultStoreFromEnv(origin, { ORYQEN_VAULT_LOCAL_DIR: "C:/vault" })?.kind).toBe("local");
  });
});
