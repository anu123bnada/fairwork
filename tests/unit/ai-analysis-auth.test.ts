import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
const mocks = vi.hoisted(() => ({ identity: vi.fn(), analyze: vi.fn() }));
vi.mock("@/server/identity", () => ({ identityCommand: mocks.identity }));
vi.mock("@/server/ai/gateway", () => ({ analyzeOfferWithGateway: mocks.analyze, providerStatuses: () => [] }));
import { POST } from "@/app/api/v1/offers/analyze/route";
const request = (body: unknown, origin = "http://127.0.0.1:3100") => new Request("http://127.0.0.1:3100/api/v1/offers/analyze", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100"); vi.stubEnv("FAIRWORK_DATA_MODE", "synthetic"); });
afterEach(() => vi.unstubAllEnvs());
it("denies unauthenticated callers before any paid provider call", async () => {
  mocks.identity.mockRejectedValue(new AppError("AUTH_REQUIRED", 401));
  expect((await POST(request({ text: "Synthetic offer text" }))).status).toBe(401);
  expect(mocks.analyze).not.toHaveBeenCalled();
});
it("denies cross-origin requests and unknown trusted fields", async () => {
  expect((await POST(request({ text: "Synthetic offer text" }, "https://evil.example"))).status).toBe(403);
  expect(mocks.identity).not.toHaveBeenCalled();
  mocks.identity.mockResolvedValue({ id: crypto.randomUUID() });
  expect((await POST(request({ text: "Synthetic offer text", ownerId: crypto.randomUUID() }))).status).toBe(422);
  expect(mocks.analyze).not.toHaveBeenCalled();
});
it("keeps unconfigured provider results truthful and private", async () => {
  mocks.identity.mockResolvedValue({ id: crypto.randomUUID() });
  mocks.analyze.mockResolvedValue({ configured: false, status: "UNCONFIGURED", data: null });
  const response = await POST(request({ text: "Synthetic offer text" }));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect((await response.json()).data).toEqual({ configured: false, status: "UNCONFIGURED", data: null });
});
it("does not disclose a late result after the account loses access",async()=>{
 mocks.identity.mockResolvedValueOnce({id:crypto.randomUUID()}).mockRejectedValueOnce(new AppError("AUTH_REQUIRED",401));
 mocks.analyze.mockResolvedValue({configured:true,status:"SUCCESS",data:{privateResult:"must not be returned"}});
 const response=await POST(request({text:"Synthetic offer text"}));
 expect(response.status).toBe(401);expect(JSON.stringify(await response.json())).not.toContain("privateResult");
});
