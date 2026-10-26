import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), after: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
vi.mock("next/server", async importOriginal => ({ ...(await importOriginal<typeof import("next/server")>()), after: mocks.after }));
import { GET as listGet, POST as createPost } from "@/app/api/v1/developer/webhooks/route";
import { POST as deletePost } from "@/app/api/v1/developer/webhooks/delete/route";
import { POST as testPost } from "@/app/api/v1/developer/webhooks/test/route";
import { POST as revokePost } from "@/app/api/v1/credentials/revoke/route";

const ORIGIN = "http://localhost:3000";
const id = (n: number) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const post = (path: string, body: unknown, origin = ORIGIN) => new Request(`${ORIGIN}${path}`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); vi.unstubAllEnvs(); vi.stubEnv("APP_ORIGIN", ORIGIN);
  mocks.getUser.mockResolvedValue({ data: { user: { id: id(1) } }, error: null });
});

describe("webhook endpoint management", () => {
  it("validates the address before the database, then returns the signing secret exactly once", async () => {
    mocks.rpc.mockImplementation(async (_name: string, args: { request: { webhookId: string; url: string } }) => ({ data: { webhookId: args.request.webhookId, url: args.request.url }, error: null }));
    for (const url of ["http://hooks.example.test/x", "https://127.0.0.1/x", "https://localhost/x", "https://user:pw@hooks.example.test/x", "https://hooks.example.test:8443/x", "nonsense"]) expect((await createPost(post("/api/v1/developer/webhooks", { url }))).status, url).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
    const response = await createPost(post("/api/v1/developer/webhooks", { url: "https://hooks.example.test/oryqen" }));
    expect(response.status).toBe(200);
    const data = (await response.json()).data, sent = mocks.rpc.mock.calls[0]![1].request;
    expect(data.secret).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(sent.secret).toBe(data.secret); expect(sent.url).toBe("https://hooks.example.test/oryqen");
    mocks.rpc.mockResolvedValue({ data: { items: [{ webhookId: id(5), url: sent.url, createdAt: "2026-10-27T00:00:00Z", lastDelivery: null }] }, error: null });
    const listed = JSON.stringify(await (await listGet(new Request(`${ORIGIN}/api/v1/developer/webhooks`))).json());
    expect(listed).not.toContain(data.secret);
  });

  it("requires sign-in and same origin, rejects extra fields, and maps the endpoint limit", async () => {
    expect((await createPost(post("/api/v1/developer/webhooks", { url: "https://hooks.example.test/x" }, "https://evil.example.test"))).status).toBe(403);
    expect((await createPost(post("/api/v1/developer/webhooks", { url: "https://hooks.example.test/x", secret: "mine" }))).status).toBe(422);
    expect((await deletePost(post("/api/v1/developer/webhooks/delete", { webhookId: id(1), extra: 1 }))).status).toBe(422);
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect((await createPost(post("/api/v1/developer/webhooks", { url: "https://hooks.example.test/x" }))).status).toBe(401);
    expect((await listGet(new Request(`${ORIGIN}/api/v1/developer/webhooks`))).status).toBe(401);
    expect((await testPost(post("/api/v1/developer/webhooks/test", { webhookId: id(1) }))).status).toBe(401);
    mocks.getUser.mockResolvedValue({ data: { user: { id: id(1) } }, error: null });
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "RATE_LIMITED", code: "P0001" } });
    expect((await createPost(post("/api/v1/developer/webhooks", { url: "https://hooks.example.test/x" }))).status).toBe(429);
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "NOT_FOUND", code: "P0001" } });
    expect((await deletePost(post("/api/v1/developer/webhooks/delete", { webhookId: id(7) }))).status).toBe(404);
  });

  it("a test event for an endpoint the caller does not own is NOT_FOUND and reaches no network", async () => {
    mocks.rpc.mockResolvedValue({ data: { items: [] }, error: null });
    expect((await testPost(post("/api/v1/developer/webhooks/test", { webhookId: id(9) }))).status).toBe(404);
  });
});

describe("revocation triggers webhooks after the response", () => {
  it("schedules the notification only after a successful revocation and survives a missing request scope", async () => {
    mocks.rpc.mockResolvedValue({ data: { credentialId: id(3), status: "revoked" }, error: null });
    expect((await revokePost(post("/api/v1/credentials/revoke", { credentialId: id(3) }))).status).toBe(200);
    expect(mocks.after).toHaveBeenCalledTimes(1);
    mocks.after.mockImplementation(() => { throw new Error("outside request scope"); });
    expect((await revokePost(post("/api/v1/credentials/revoke", { credentialId: id(3) }))).status).toBe(200);
    mocks.after.mockReset(); mocks.rpc.mockResolvedValue({ data: null, error: { message: "NOT_FOUND", code: "P0001" } });
    expect((await revokePost(post("/api/v1/credentials/revoke", { credentialId: id(4) }))).status).toBe(404);
    expect(mocks.after).not.toHaveBeenCalled();
  });
});
