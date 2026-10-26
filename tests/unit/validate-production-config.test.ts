import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const jwk = JSON.stringify({ kty: "OKP", crv: "Ed25519", x: "x".repeat(43), d: "d".repeat(43) });
const good: Record<string, string> = {
  APP_ORIGIN: "https://app.example.test", FAIRWORK_DATA_MODE: "supabase", AUTH_REGISTRATION_ENABLED: "false",
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_abcdefghijklmnop",
  ORYQEN_CREDENTIAL_KEY_ID: "oryqen-2026-1", ORYQEN_CREDENTIAL_SIGNING_KEY: jwk,
  ORYQEN_VAULT_STORAGE_URL: "https://abcdefgh.supabase.co", ORYQEN_VAULT_STORAGE_SERVICE_KEY: "server-only-secret-value",
};
function run(env: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), "cfg-"));
  try {
    const file = path.join(dir, "env");
    writeFileSync(file, Object.entries(env).map(([key, value]) => `${key}=${value}`).join("\n"));
    const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(APP_ORIGIN|FAIRWORK_|AUTH_REG|NEXT_PUBLIC_|ORYQEN_|GEMINI|GOOGLE_API|SUPABASE_)/.test(key)));
    const result = spawnSync(process.execPath, ["scripts/validate-production-config.mjs", `--env-file=${file}`, "--json"], { encoding: "utf8", env: clean as NodeJS.ProcessEnv });
    return { status: result.status, out: result.stdout, report: JSON.parse(result.stdout) as { failed: number; results: { id: string; status: string }[] } };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
const failing = (env: Record<string, string>) => run(env).report.results.filter(item => item.status === "FAIL").map(item => item.id);

describe("production configuration validator", () => {
  it("passes a complete, safe configuration and never prints a value", () => {
    const result = run(good);
    expect(result.status).toBe(0); expect(result.report.failed).toBe(0);
    for (const secret of ["server-only-secret-value", "d".repeat(43), "sb_publishable_abcdefghijklmnop"]) expect(result.out).not.toContain(secret);
  });
  it("fails each unsafe setting by name", () => {
    expect(failing({ ...good, APP_ORIGIN: "http://app.example.test" })).toContain("APP_ORIGIN");
    expect(failing({ ...good, APP_ORIGIN: "https://localhost" })).toContain("APP_ORIGIN");
    expect(failing({ ...good, APP_ORIGIN: "https://app.example.test/app" })).toContain("APP_ORIGIN");
    expect(failing({ ...good, FAIRWORK_DATA_MODE: "synthetic" })).toContain("FAIRWORK_DATA_MODE");
    expect(failing({ ...good, AUTH_REGISTRATION_ENABLED: "maybe" })).toContain("AUTH_REGISTRATION_ENABLED");
    expect(failing({ ...good, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_secret_abcdefghijklmnop" })).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    const serviceJwt = `x.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.y`.replace(/^x/, "eyJhbGciOiJIUzI1NiJ9");
    expect(failing({ ...good, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: serviceJwt })).toContain("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
    expect(failing({ ...good, SUPABASE_SERVICE_ROLE_KEY: "anything" })).toContain("service-role-key");
    expect(failing({ ...good, NEXT_PUBLIC_GEMINI_API_KEY: "x" })).toContain("public-variable-names");
    expect(failing({ ...good, ORYQEN_VAULT_LOCAL_DIR: "C:/vault" })).toContain("vault-local-store");
  });
  it("requires complete credential, vault and AI settings together", () => {
    const { ORYQEN_CREDENTIAL_SIGNING_KEY: _removed, ...partial } = good; void _removed;
    expect(failing(partial)).toContain("credential-signing");
    expect(failing({ ...good, ORYQEN_CREDENTIAL_SIGNING_KEY: JSON.stringify({ kty: "OKP", crv: "Ed25519", x: "x".repeat(43) }) })).toContain("credential-signing"); // a public key is not a signing key
    expect(failing({ ...good, ORYQEN_VAULT_STORAGE_URL: "http://storage.example.test" })).toContain("vault-storage");
    expect(failing({ ...good, ORYQEN_AI_ENABLED: "true" })).toContain("ai");
    expect(failing({ ...good, ORYQEN_AI_POLICY_APPROVED: "true" })).toContain("ai");
    expect(failing({ ...good, ORYQEN_AI_ENABLED: "true", ORYQEN_AI_POLICY_APPROVED: "true", GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-x", ORYQEN_AI_POLICY_APPROVAL_REF: "OWNER-APPROVAL-1", ORYQEN_AI_PROCESSING_REGION: "eu", ORYQEN_AI_DATA_USE: "no training" })).not.toContain("ai");
    expect(failing({ ...good, ORYQEN_TELEMETRY_DB_URL: "postgresql://postgres:pw@db.example.test/postgres" })).toContain("telemetry-role");
  });
});

describe("AI fallback configuration", () => {
  const aiOn = { ORYQEN_AI_ENABLED: "true", ORYQEN_AI_POLICY_APPROVED: "true", GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-x", ORYQEN_AI_POLICY_APPROVAL_REF: "OWNER-APPROVAL-1", ORYQEN_AI_PROCESSING_REGION: "eu", ORYQEN_AI_DATA_USE: "no training" };
  it("requires every listed fallback to be complete and approved on its own settings", () => {
    expect(failing({ ...good, ...aiOn, ORYQEN_AI_FALLBACK_PROVIDERS: "openai" })).toContain("ai-fallbacks"); // the primary's approval does not approve OpenAI
    expect(failing({ ...good, ...aiOn, ORYQEN_AI_FALLBACK_PROVIDERS: "openai", OPENAI_API_KEY: "k", ORYQEN_AI_OPENAI_POLICY_APPROVAL_REF: "OWNER-APPROVAL-2", ORYQEN_AI_OPENAI_PROCESSING_REGION: "us", ORYQEN_AI_OPENAI_DATA_USE: "no training" })).not.toContain("ai-fallbacks");
    expect(failing({ ...good, ...aiOn, ORYQEN_AI_FALLBACK_PROVIDERS: "anthropic" })).toContain("ai-fallbacks");
    expect(failing({ ...good, ...aiOn, ORYQEN_AI_FALLBACK_PROVIDERS: "gemini" })).toContain("ai-fallbacks");
    expect(failing({ ...good, ...aiOn, ORYQEN_AI_FALLBACK_PROVIDERS: "selfhosted", ORYQEN_SELFHOSTED_AI_URL: "https://llm.example.test", ORYQEN_SELFHOSTED_AI_MODEL: "llama" })).toContain("ai-fallbacks");
  });
});
