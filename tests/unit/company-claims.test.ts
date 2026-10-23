import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
import { GET, POST } from "@/app/api/v1/companies/route";
const companyId = "40000000-0000-4000-8000-000000000012";
const body = { companyId, expectedVersion: 0, claims: { description: "Claim", website: "https://example.test", location: "", industry: "" } };
const request = (value: unknown, origin = "http://localhost:3100") => new Request("http://localhost:3100/api/v1/companies", { method: "POST", headers: { origin, "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(value) });
beforeEach(() => {
 vi.resetAllMocks(); vi.stubEnv("APP_ORIGIN", "http://localhost:3100"); vi.stubEnv("FAIRWORK_DATA_MODE", "synthetic");
 mocks.getUser.mockResolvedValue({ data: { user: { id: companyId, is_anonymous: false } }, error: null });
});
afterEach(() => vi.unstubAllEnvs());
it("rejects forged verification, untrusted authority, unsafe URL schemes and duplicate filters", async () => {
 for (const value of [{...body,verified:true},{...body,actorId:companyId},{...body,claims:{...body.claims,website:"javascript:alert(1)"}}]) expect((await POST(request(value))).status).toBe(422);
 expect((await GET(new Request("http://localhost/api?query=a&query=b"))).status).toBe(422);
 expect(mocks.rpc).not.toHaveBeenCalled();
});
it("requires real authentication and same-origin writes", async () => {
 expect((await POST(request(body,"https://other.example"))).status).toBe(403);
 mocks.getUser.mockResolvedValue({data:{user:null},error:null});
 expect((await GET(new Request("http://localhost/api"))).status).toBe(401);expect(mocks.rpc).not.toHaveBeenCalled();
});
it("preserves server authorization and version failures", async () => {
 mocks.rpc.mockResolvedValue({data:null,error:{message:"VERSION_CONFLICT"}});
 expect((await POST(request(body))).status).toBe(409);
 mocks.rpc.mockResolvedValue({data:null,error:{message:"NOT_FOUND"}});
 expect((await GET(new Request(`http://localhost/api?companyId=${companyId}`))).status).toBe(404);
});
