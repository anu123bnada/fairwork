import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ identityCommand: vi.fn() }));
vi.mock("@/server/identity", () => mocks);
import { PATCH } from "@/app/api/v1/me/route";
const key = "40000000-0000-4000-8000-000000000001";
const input = { displayName: "Synthetic Worker", timeZone: "Asia/Colombo", locale: "en", expectedRevision: 3 };
function request(body: unknown, origin = "http://localhost:3000") {
  return new Request("http://localhost:3000/api/v1/me", { method: "PATCH", headers: { origin, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) });
}
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("APP_ORIGIN", "http://localhost:3000"); });
describe("profile editing transport preserves identity and revision boundary", () => {
  it("passes only validated fields plus header idempotency and forbids caching", async () => {
    mocks.identityCommand.mockResolvedValue({ revision: 4 });
    const response = await PATCH(request(input));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.identityCommand).toHaveBeenCalledWith("update_profile", { ...input, idempotencyKey: key }, response.headers.get("x-request-id"));
  });
  it("denies forged actor and capabilities before the command", async () => {
    for (const extra of [{ id: key }, { capabilities: ["reviewer"] }, { role: "ADMIN" }]) expect((await PATCH(request({ ...input, ...extra }))).status).toBe(422);
    expect(mocks.identityCommand).not.toHaveBeenCalled();
  });
  it("denies cross-origin, invalid zone and missing revision", async () => {
    expect((await PATCH(request(input, "https://untrusted.example"))).status).toBe(403);
    expect((await PATCH(request({ ...input, timeZone: "invalid-zone" }))).status).toBe(422);
    expect((await PATCH(request({ displayName: input.displayName, timeZone: "UTC", locale: "en" }))).status).toBe(422);
    expect(mocks.identityCommand).not.toHaveBeenCalled();
  });
});
