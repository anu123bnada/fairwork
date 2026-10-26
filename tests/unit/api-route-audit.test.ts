import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Static audit of the HTTP surface. It reads the source of every route handler and every source file, so a future route that forgets
// a protection fails here instead of in production. Each exception is explained, and an exception that stops being needed fails too.
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => { const file = path.join(dir, name); return statSync(file).isDirectory() ? walk(file) : [file]; });
const rel = (file: string) => file.replace(/\\/g, "/");
const routes = walk("src/app").filter(file => /[\\/]route\.ts$/.test(file)).map(rel);
const writes = /export\s+(?:async\s+)?function\s+(?:POST|PUT|PATCH|DELETE)\b/;

// Mutating routes that are deliberately not protected by the same-origin check, with the reason.
const NO_ORIGIN_CHECK: Record<string, string> = {
  "src/app/api/v1/developer/credentials/verify/route.ts": "server-to-server bearer API; the secret key is the credential and no cookie is read, so there is no ambient authority to forge",
};
// Routes that answer without the shared JSON envelope, with the reason.
const NO_ENVELOPE: Record<string, string> = {
  "src/app/api/v1/vault/blob/route.ts": "streams a file behind a short-lived signed token",
  "src/app/.well-known/oryqen-keys.json/route.ts": "public key set in a fixed document format",
};
// Routes that read the raw request body themselves, because they stream it with their own size cap.
const RAW_BODY: Record<string, string> = {
  "src/app/api/v1/vault/route.ts": "multipart upload read through a capped stream before parsing",
};

describe("route handler audit", () => {
  it("finds the route handlers", () => { expect(routes.length).toBeGreaterThan(50); });

  it("every mutating route checks the request origin (CSRF) unless it is a documented bearer-key API", () => {
    const missing: string[] = [], unused: string[] = [];
    for (const name of routes) {
      const text = readFileSync(name, "utf8");
      if (!writes.test(text)) continue;
      const checked = /assertSameOrigin\(/.test(text);
      if (NO_ORIGIN_CHECK[name]) { if (checked) unused.push(name); continue; }
      if (!checked) missing.push(name);
    }
    expect(missing, `mutating routes without assertSameOrigin: ${missing.join(", ")}`).toEqual([]);
    expect(unused, "allow-listed routes that now check the origin: remove them from the list").toEqual([]);
  });

  it("every route answers through the shared envelope, so errors never carry stacks, provider messages or inputs", () => {
    const missing = routes.filter(name => !NO_ENVELOPE[name] && !/apiResponse\(/.test(readFileSync(name, "utf8")));
    expect(missing, `routes without apiResponse: ${missing.join(", ")}`).toEqual([]);
  });

  it("routes read bodies through the size-capped, schema-validated readers", () => {
    const loose = routes.filter(name => !RAW_BODY[name] && /request\.(json|text|formData)\(\)/.test(readFileSync(name, "utf8")));
    expect(loose, `routes reading raw bodies: ${loose.join(", ")}`).toEqual([]);
  });

  it("no route trusts a client-supplied user id, role or capability field", () => {
    const risky = routes.filter(name => /searchParams\.get\(["'](?:userId|actorId|ownerId|holderId|role|capability)["']\)/.test(readFileSync(name, "utf8")));
    expect(risky).toEqual([]);
  });
});

describe("source audit", () => {
  const sources = walk("src").map(rel).filter(file => /\.(ts|tsx)$/.test(file));
  const read = (file: string) => readFileSync(file, "utf8");

  it("has no raw HTML injection, dynamic code execution or document.write", () => {
    const offenders = sources.filter(file => /dangerouslySetInnerHTML|\beval\(|new Function\(|document\.write\(|\.innerHTML\s*=/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it("never reads a secret through a public environment name, and client components read no private environment variables", () => {
    const publicSecrets = sources.filter(file => /process\.env\.NEXT_PUBLIC_[A-Z_]*(?:SECRET|SERVICE|PRIVATE|SIGNING|GEMINI|PASSWORD|TOKEN)/.test(read(file)));
    expect(publicSecrets).toEqual([]);
    const clientLeaks = sources.filter(file => /^["']use client["']/.test(read(file)) && /process\.env\.(?!NODE_ENV|NEXT_PUBLIC_)/.test(read(file)));
    expect(clientLeaks).toEqual([]);
  });

  it("does not redirect to a location taken from the query string", () => {
    const offenders = sources.filter(file => /redirect\([^)]*(?:searchParams|request\.url)/.test(read(file)));
    expect(offenders).toEqual([]);
  });

  it("server modules that name a server secret are marked server-only", () => {
    const secretUsers = sources.filter(file => /ORYQEN_CREDENTIAL_SIGNING_KEY|ORYQEN_VAULT_STORAGE_SERVICE_KEY|GEMINI_API_KEY/.test(read(file)));
    const unmarked = secretUsers.filter(file => !/import ["']server-only["']/.test(read(file)));
    expect(unmarked, `files that name a server secret without server-only: ${unmarked.join(", ")}`).toEqual([]);
  });
});
