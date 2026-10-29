import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Private employment text may leave the server for an AI provider only through one path: the analyze route -> consent check -> gateway -> provider adapter,
// which is closed unless the owner enabled AI AND approved the policy. These checks fail if a second path to a provider is added, if the adapter is imported by
// anything that skips the consent/receipt hooks, or if the shipped defaults turn AI on.
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => { const file = path.join(dir, name); return statSync(file).isDirectory() ? walk(file) : [file]; });
const sources = walk("src").filter(file => /\.(ts|tsx)$/.test(file)).map(file => file.split(path.sep).join("/"));
const text = (file: string) => readFileSync(file, "utf8");

describe("AI provider egress", () => {
  it("names a model-provider host only inside the provider adapter (and its health probe)", () => {
    const hosts = /generativelanguage\.googleapis\.com|api\.openai\.com|api\.anthropic\.com|aiplatform\.googleapis\.com|openrouter\.ai/;
    const offenders = sources.filter(file => hosts.test(text(file)) && file !== "src/server/ai/provider.ts" && !/^src\/server\/ai\/(health|gemini-diagnostic)\.ts$/.test(file));
    expect(offenders).toEqual([]);
  });
  it("only the analyze route and the gateway reach the provider adapter, and the route runs the consent check first", () => {
    const importers = sources.filter(file => /from "(@\/server\/ai\/provider|\.\/provider)"/.test(text(file))).sort();
    expect(importers).toEqual(["src/server/ai/gateway.ts"]);
    const callers = sources.filter(file => /analyzeOfferWithGateway\(/.test(text(file)) && file !== "src/server/ai/gateway.ts");
    expect(callers).toEqual(["src/app/api/v1/offers/analyze/route.ts"]);
    const route = text("src/app/api/v1/offers/analyze/route.ts");
    expect(route.indexOf("identityCommand(\"get_me\"")).toBeGreaterThan(-1);
    expect(route.indexOf("assertPrimaryConsent(")).toBeGreaterThan(route.indexOf("identityCommand(\"get_me\""));
    expect(route.indexOf("analyzeOfferWithGateway(")).toBeGreaterThan(route.indexOf("assertPrimaryConsent("));
    expect(route).toContain("authorize: config => authorizeProviderTransmission(");
  });
  it("the provider adapter is the only code that calls fetch inside the AI folder and never reads the user's session or database", () => {
    for (const file of sources.filter(f => f.startsWith("src/server/ai/") && f !== "src/server/ai/provider.ts")) expect(text(file), file).not.toMatch(/(?<![\w.])fetch\(/);
    const adapter = text("src/server/ai/provider.ts");
    expect(adapter).not.toMatch(/createServerSupabase|supabase\.rpc|\.from\(/);
  });
  it("ships with AI off: both switches default to false and no key is set in the example environment", () => {
    const example = text(".env.example");
    expect(example).toMatch(/^ORYQEN_AI_ENABLED=false\s*$/m);
    expect(example).not.toMatch(/^ORYQEN_AI_POLICY_APPROVED=true/m);
    for (const name of ["GEMINI_API_KEY", "GOOGLE_API_KEY", "OPENAI_API_KEY", "ORYQEN_SELFHOSTED_AI_KEY"]) expect(example, name).not.toMatch(new RegExp(`^${name}=.`, "m"));
  });
  it("no client-visible variable name can carry a provider key", () => {
    const names = new Set(sources.flatMap(file => text(file).match(/NEXT_PUBLIC_[A-Z0-9_]+/g) ?? []));
    expect([...names].filter(name => /KEY|SECRET|TOKEN|PASSWORD/.test(name) && name !== "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")).toEqual([]);
  });
});
