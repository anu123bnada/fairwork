import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildEvent, deliver, guardedLookup, isPublicAddress, signPayload, validateTargetUrl, verifySignature, type Transport } from "@/server/developer/webhook";
import { notifyOwner, pingEndpoint } from "@/server/developer/webhook-service";

const SECRET = "s".repeat(43);
const NOW = new Date("2026-10-27T12:00:00Z"), nowSeconds = Math.floor(NOW.getTime() / 1000);
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("webhook signatures", () => {
  it("verifies a genuine delivery and rejects tampering, wrong secrets, malformed headers and stale or future timestamps", () => {
    const body = JSON.stringify({ id: id(1), type: "ping" }), header = signPayload(SECRET, body, nowSeconds);
    expect(header).toMatch(/^t=\d+,v1=[0-9a-f]{64}$/);
    expect(verifySignature(header, body, SECRET, nowSeconds)).toBe(true);
    expect(verifySignature(header, body + " ", SECRET, nowSeconds)).toBe(false);
    expect(verifySignature(header, body, "x".repeat(43), nowSeconds)).toBe(false);
    for (const bad of [null, undefined, "", "v1=abc", `t=${nowSeconds}`, `t=${nowSeconds},v1=${"0".repeat(63)}`, `t=abc,v1=${"0".repeat(64)}`, `${header},extra`]) expect(verifySignature(bad, body, SECRET, nowSeconds), String(bad)).toBe(false);
    expect(verifySignature(header, body, SECRET, nowSeconds + 299)).toBe(true);
    expect(verifySignature(header, body, SECRET, nowSeconds + 301)).toBe(false); // a captured delivery cannot be replayed later
    expect(verifySignature(header, body, SECRET, nowSeconds - 301)).toBe(false);
    const other = signPayload(SECRET, body, nowSeconds + 1); // the timestamp is part of what is signed
    expect(verifySignature(`t=${nowSeconds},v1=${other.split("v1=")[1]}`, body, SECRET, nowSeconds)).toBe(false);
  });
});

describe("destination checks", () => {
  it("classifies addresses: public ones pass; loopback, private, link-local, metadata, CGNAT and reserved ones never do", () => {
    for (const ok of ["8.8.8.8", "93.184.216.34", "172.32.0.1", "2606:4700:4700::1111"]) expect(isPublicAddress(ok), ok).toBe(true);
    for (const bad of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1", "::1", "::", "fe80::1", "fc00::1", "fd12::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "2001:db8::1", "not an ip", ""]) expect(isPublicAddress(bad), bad).toBe(false);
  });
  it("accepts only https names on the standard port without credentials or private targets", () => {
    expect(validateTargetUrl("https://hooks.example.test/oryqen?a=1").hostname).toBe("hooks.example.test");
    for (const bad of ["http://hooks.example.test/x", "ftp://hooks.example.test", "https://user:pw@hooks.example.test/", "https://hooks.example.test:8443/", "https://localhost/x", "https://api.localhost/x", "https://printer.local/x", "https://db.internal/x", "https://intranet/x", "https://127.0.0.1/x", "https://[::1]/x", "https://169.254.169.254/latest", "https://10.0.0.5/x", "not a url", "javascript:alert(1)"]) expect(() => validateTargetUrl(bad), bad).toThrow();
  });
  it("refuses a name at connection time when any answer is private, even if another answer is public", async () => {
    const run = (answers: { address: string; family: number }[], all = false) => new Promise<{ error: Error | null; address: unknown }>(resolve => {
      guardedLookup(async () => answers)("hooks.example.test", { all } as never, ((error: Error | null, address: unknown) => resolve({ error, address })) as never);
    });
    expect((await run([{ address: "93.184.216.34", family: 4 }])).address).toBe("93.184.216.34");
    expect((await run([{ address: "93.184.216.34", family: 4 }], true)).address).toEqual([{ address: "93.184.216.34", family: 4 }]);
    expect((await run([{ address: "93.184.216.34", family: 4 }, { address: "127.0.0.1", family: 4 }])).error).toMatchObject({ code: "EBLOCKED" });
    expect((await run([{ address: "169.254.169.254", family: 4 }])).error).toMatchObject({ code: "EBLOCKED" });
    expect((await run([])).error).toMatchObject({ code: "EBLOCKED" });
  });
});

describe("delivery", () => {
  const event = buildEvent("credential.revoked", { credentialId: id(9) }, NOW, id(1));
  const statuses = (...codes: (number | "error")[]) => { const calls: { headers: Record<string, string>; body: string }[] = []; let i = 0; const transport: Transport = async request => { calls.push({ headers: request.headers, body: request.body }); const code = codes[Math.min(i++, codes.length - 1)]!; if (code === "error") throw new Error("network"); return { status: code }; }; return { transport, calls }; };
  const run = (codes: (number | "error")[]) => { const t = statuses(...codes), sleeps: number[] = []; return deliver({ url: "https://hooks.example.test/in", secret: SECRET, event, transport: t.transport, sleep: async ms => { sleeps.push(ms); }, now: () => NOW }).then(results => ({ results, calls: t.calls, sleeps })); };

  it("signs every attempt and delivers on the first success", async () => {
    const { results, calls, sleeps } = await run([204]);
    expect(results).toEqual([{ attempt: 1, outcome: "delivered", statusCode: 204 }]); expect(sleeps).toEqual([]);
    expect(calls[0]!.headers["Oryqen-Event-Id"]).toBe(id(1)); expect(calls[0]!.headers["Oryqen-Event-Type"]).toBe("credential.revoked");
    expect(verifySignature(calls[0]!.headers["Oryqen-Signature"], calls[0]!.body, SECRET, nowSeconds)).toBe(true);
    expect(JSON.parse(calls[0]!.body)).toEqual({ id: id(1), type: "credential.revoked", createdAt: NOW.toISOString(), data: { credentialId: id(9) } });
  });
  it("retries network errors and server errors with backoff, then stops after success", async () => {
    const { results, sleeps, calls } = await run(["error", 503, 200]);
    expect(results.map(item => [item.attempt, item.outcome, item.statusCode])).toEqual([[1, "failed", null], [2, "failed", 503], [3, "delivered", 200]]);
    expect(sleeps).toEqual([1000, 5000]); expect(new Set(calls.map(call => call.headers["Oryqen-Event-Id"])).size).toBe(1); // same event id on every retry
  });
  it("gives up after three attempts and never retries final answers such as 400, 404 or a redirect", async () => {
    expect((await run([500, 500, 500])).results).toHaveLength(3);
    for (const code of [400, 401, 404, 301, 302]) expect((await run([code, 200])).results, String(code)).toEqual([{ attempt: 1, outcome: "failed", statusCode: code }]);
    for (const code of [408, 429]) expect((await run([code, 200])).results.at(-1)).toMatchObject({ outcome: "delivered" });
  });
  it("refuses an unsafe address before any request is made", async () => {
    const t = statuses(200);
    await expect(deliver({ url: "https://127.0.0.1/x", secret: SECRET, event, transport: t.transport })).rejects.toThrow();
    expect(t.calls).toHaveLength(0);
  });
});

describe("owner notification", () => {
  const targets = [{ webhookId: id(11), url: "https://a.example.test/in", secret: SECRET }, { webhookId: id(12), url: "https://10.0.0.9/in", secret: SECRET }];
  const rpcWith = (log: unknown[]) => vi.fn(async (name: string, payload: Record<string, unknown>) => {
    if (name === "webhook_targets") return { data: { items: targets }, error: null };
    log.push(payload); return { data: { logged: true }, error: null };
  });
  const options = { transport: (async () => ({ status: 200 })) as Transport, sleep: async () => undefined, now: () => NOW };

  it("delivers to every registered endpoint, logs each attempt, and treats an unsafe endpoint as a failed delivery", async () => {
    const log: unknown[] = []; const rpc = rpcWith(log);
    const result = await notifyOwner(rpc, "credential.revoked", { credentialId: id(9) }, options);
    expect(result.results.map(item => [item.webhookId, item.attempts[0]!.outcome])).toEqual([[id(11), "delivered"], [id(12), "failed"]]);
    expect(log).toEqual([{ webhookId: id(11), eventId: result.eventId, eventType: "credential.revoked", attempt: 1, outcome: "delivered", statusCode: 200 }]); // the unsafe endpoint made no request
  });
  it("never throws, even when the database is unreachable", async () => {
    await expect(notifyOwner(async () => { throw new Error("down"); }, "ping", {}, options)).resolves.toMatchObject({ results: [] });
    await expect(notifyOwner(async () => ({ data: null, error: { message: "x" } }), "ping", {}, options)).resolves.toMatchObject({ results: [] });
  });
  it("pings one endpoint once and reports what it answered; an unknown endpoint is null", async () => {
    const rpc = rpcWith([]); let calls = 0;
    const flaky: Transport = async () => { calls += 1; return { status: 503 }; };
    expect(await pingEndpoint(rpc, id(11), { ...options, transport: flaky })).toMatchObject({ attempt: { attempt: 1, outcome: "failed", statusCode: 503 } });
    expect(calls).toBe(1);
    expect(await pingEndpoint(rpc, id(99), options)).toBeNull();
  });
});
