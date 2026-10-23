import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
import { POST, GET } from "@/app/api/v1/organizations/route";
import { POST as decide, GET as queue } from "@/app/api/v1/operator/organization-requests/route";
const id = "40000000-0000-4000-8000-000000000012";
const input = { companyId: null, companyName: "Synthetic company", statement: "Synthetic request for independent review" };
const request = (body: unknown, origin = "http://localhost:3100") => new Request("http://localhost:3100/api/v1/organizations", { method: "POST", headers: { origin, "content-type": "application/json", "idempotency-key": id }, body: JSON.stringify(body) });
beforeEach(() => {
 vi.resetAllMocks(); vi.stubEnv("APP_ORIGIN", "http://localhost:3100"); vi.stubEnv("FAIRWORK_DATA_MODE", "synthetic");
 mocks.getUser.mockResolvedValue({ data: { user: { id, is_anonymous: false } }, error: null });
 mocks.rpc.mockResolvedValue({ data: { requestId: id }, error: null });
});
afterEach(() => vi.unstubAllEnvs());
it("denies unauthenticated submission and cross-origin requests", async () => {
 expect((await POST(request(input, "https://other.example"))).status).toBe(403);
 mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
 expect((await POST(request(input))).status).toBe(401); expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects forged applicant, authority and ambiguous organization inputs", async () => {
 for (const body of [{ ...input, subjectId: id }, { ...input, approved: true }, { ...input, companyId: id }, { ...input, companyName: null }]) expect((await POST(request(body))).status).toBe(422);
 expect(mocks.rpc).not.toHaveBeenCalled();
});
it("preserves idempotency and derives identity only inside database", async () => {
 expect((await POST(request(input))).status).toBe(200);
 expect(mocks.rpc).toHaveBeenCalledWith("request_organization", { request: { ...input, idempotencyKey: id } });
});
it("fails closed on revoked operator authority returned by database", async () => {
 mocks.rpc.mockResolvedValue({ data: null, error: { message: "ACTION_FORBIDDEN" } });
 expect((await queue(new Request("http://localhost/api"))).status).toBe(403);
 expect((await decide(request({ requestId: id, decision: "reject", reason: "Insufficient evidence", expiresAt: null, reviewedEvidenceRefs: [], expectedRevision: 0 }))).status).toBe(403);
});
it("rejects applicant selection and invalid decision evidence", async () => {
 expect((await GET(new Request(`http://localhost/api?subjectId=${id}`))).status).toBe(422);
 expect((await decide(request({ requestId: id, decision: "approve", reason: "claim", expiresAt: null, reviewedEvidenceRefs: [], expectedRevision: 0 }))).status).toBe(422);
 expect(mocks.rpc).not.toHaveBeenCalled();
});
