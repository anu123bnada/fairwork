import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { getUser: mocks.getUser }, rpc: mocks.rpc }) }));
import { GET } from "@/app/api/v1/organizations/team/route";
const url = "http://localhost:3000/api/v1/organizations/team", companyId = "40000000-0000-4000-8000-0000000000d1";
const member = { self: true, role: "representative", status: "active", effectiveAt: "2026-10-26T00:00:00Z", expiresAt: "2026-11-20T00:00:00Z" };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getUser.mockResolvedValue({ data: { user: { id: "rep" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { companyId, members: [member], changeProcess: "operator_reviewed" }, error: null });
});
it("returns a private roster for one organization through the RPC", async () => {
  const response = await GET(new Request(`${url}?companyId=${companyId}`));
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.rpc).toHaveBeenCalledWith("company_team", { request: { companyId } });
});
it("rejects bad queries and anonymous callers, and treats unexpected data as unavailable", async () => {
  for (const query of ["", "?companyId=bad", `?companyId=${companyId}&actorId=x`]) expect((await GET(new Request(`${url}${query}`))).status).toBe(422);
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValue({ data: { companyId, members: [{ ...member, name: "Leaked Name" }], changeProcess: "operator_reviewed" }, error: null });
  expect((await GET(new Request(`${url}?companyId=${companyId}`))).status).toBe(503);
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await GET(new Request(`${url}?companyId=${companyId}`))).status).toBe(401);
});
it("maps a denied or unknown organization to a not-found response", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { message: "NOT_FOUND", code: "P0001" } });
  expect((await GET(new Request(`${url}?companyId=${companyId}`))).status).toBe(404);
});
