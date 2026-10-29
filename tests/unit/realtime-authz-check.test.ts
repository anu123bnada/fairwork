import { describe, expect, it } from "vitest";
// @ts-expect-error plain ES module without types
import { checkRealtimeAuthorization, payloadViolations, TOPIC } from "../../scripts/lib/realtime-authz-check.mjs";

type Handler = (status: string) => void;
type Result = { name: string; pass: boolean };
// A fake Realtime client that applies the proposed policy: an account may join only its own topic, and nobody may publish.
const fake = (uid: string | null, broken: "none" | "joins_everything" | "can_publish" = "none") => ({
  channel: (topic: string) => ({
    subscribe(handler: Handler) { queueMicrotask(() => handler(broken === "joins_everything" || (uid && topic === `user:${uid}`) ? "SUBSCRIBED" : "CHANNEL_ERROR")); return this; },
    async send() { return broken === "can_publish" ? "ok" : "error"; },
  }),
  removeChannel: async () => "ok",
});
const run = (over: { b?: ReturnType<typeof fake>; anonymous?: ReturnType<typeof fake>; a?: ReturnType<typeof fake> } = {}): Promise<Result[]> =>
  checkRealtimeAuthorization({ a: { client: over.a ?? fake("A"), uid: "A" }, b: { client: over.b ?? fake("B"), uid: "B" }, anonymous: over.anonymous ?? fake(null), timeoutMs: 200 });

describe("hosted Realtime authorization checker", () => {
  it("passes when each account can join only its own channel, an anonymous client nothing, and nobody can publish", async () => {
    const results = await run();
    expect(results.length).toBeGreaterThanOrEqual(11);
    expect(results.filter(r => !r.pass)).toEqual([]);
  });
  it("fails when another account can join someone else's channel", async () => {
    const results = await run({ b: fake("B", "joins_everything") });
    expect(results.find(r => r.name === "B cannot join A's channel")!.pass).toBe(false);
  });
  it("fails when an anonymous client can join", async () => {
    expect((await run({ anonymous: fake(null, "joins_everything") })).some(r => !r.pass)).toBe(true);
  });
  it("fails when clients are able to publish", async () => {
    expect((await run({ a: fake("A", "can_publish") })).find(r => r.name === "A cannot publish on its own channel")!.pass).toBe(false);
  });
  it("requires two distinct accounts", async () => {
    await expect(checkRealtimeAuthorization({ a: { client: fake("A"), uid: "A" }, b: { client: fake("A"), uid: "A" }, anonymous: fake(null) })).rejects.toThrow();
  });
  it("accepts only {area} payloads from the allowed list", () => {
    expect(payloadViolations([{ area: "work" }, { area: "cases" }])).toEqual([]);
    expect(payloadViolations([{ area: "work", id: "x" }, { area: "payroll" }, null, {}])).toHaveLength(4);
    expect(TOPIC("u")).toBe("user:u");
  });
});
