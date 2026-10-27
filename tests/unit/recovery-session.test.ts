import { beforeEach, afterEach, expect, it, vi } from "vitest";
// The tokens a default Supabase recovery or invitation email puts in the link fragment. The browser's copy is untrusted: Supabase must accept the
// access token, the refresh token must rotate to the same confirmed account, and cookies are committed only after every check.
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), refreshSession: vi.fn(), verifyOtp: vi.fn(), commit: vi.fn() }));
vi.mock("@/server/supabase", () => ({
  createServerSupabase: async () => ({ auth: { verifyOtp: mocks.verifyOtp } }),
  createStagedServerSupabase: async () => ({ client: { auth: { getUser: mocks.getUser, refreshSession: mocks.refreshSession } }, commitCookies: mocks.commit }),
}));
import { POST as confirm } from "@/app/api/v1/auth/recovery/confirm/route";

const jwt = `${"a".repeat(20)}.${"b".repeat(20)}.${"c".repeat(20)}`;
const request = (body: unknown, origin = "http://127.0.0.1:3100") => new Request("http://127.0.0.1:3100/api/v1/auth/recovery/confirm", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
const link = (over: Record<string, unknown> = {}) => ({ accessToken: jwt, refreshToken: "refreshTOKEN123", link: "recovery", ...over });
const user = (over: Record<string, unknown> = {}) => ({ id: "40000000-0000-4000-8000-000000000001", email_confirmed_at: "2026-10-27T00:00:00Z", is_anonymous: false, recovery_sent_at: "2026-10-27T01:00:00Z", invited_at: null, ...over });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100"); vi.stubEnv("FAIRWORK_DATA_MODE", "synthetic");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_configuration_test");
  mocks.getUser.mockResolvedValue({ data: { user: user() }, error: null });
  mocks.refreshSession.mockResolvedValue({ data: { user: user(), session: { user: user() } }, error: null });
});
afterEach(() => vi.unstubAllEnvs());

it("accepts a genuine recovery link: Supabase validates the access token, the refresh token rotates, then cookies are committed once", async () => {
  const response = await confirm(request(link()));
  expect(response.status).toBe(200); expect((await response.json()).data).toEqual({ confirmed: true });
  expect(mocks.getUser).toHaveBeenCalledWith(jwt);
  expect(mocks.refreshSession).toHaveBeenCalledWith({ refresh_token: "refreshTOKEN123" });
  expect(mocks.commit).toHaveBeenCalledTimes(1);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("accepts an invitation only for an account that was invited, and a recovery only for one that asked for a reset", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: user({ recovery_sent_at: null, invited_at: "2026-10-26T00:00:00Z" }) }, error: null });
  expect((await confirm(request(link({ link: "invite" })))).status).toBe(200);
  mocks.commit.mockClear();
  expect((await confirm(request(link({ link: "recovery" })))).status).toBe(401);
  expect(mocks.commit).not.toHaveBeenCalled();
});
it("leaves no session behind when the access token is rejected, expired or replayed", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401, message: "invalid JWT: secret detail" } });
  const response = await confirm(request(link()));
  expect(response.status).toBe(401);
  expect(JSON.stringify(await response.json())).not.toContain("secret detail");
  expect(mocks.refreshSession).not.toHaveBeenCalled(); expect(mocks.commit).not.toHaveBeenCalled();
});
it("leaves no session behind when the refresh token is used up or belongs to another account", async () => {
  mocks.refreshSession.mockResolvedValue({ data: { user: null, session: null }, error: { status: 400 } });
  expect((await confirm(request(link()))).status).toBe(401);
  mocks.refreshSession.mockResolvedValue({ data: { user: user({ id: "40000000-0000-4000-8000-0000000000ff" }), session: { user: user({ id: "40000000-0000-4000-8000-0000000000ff" }) } }, error: null });
  expect((await confirm(request(link()))).status).toBe(401);
  mocks.refreshSession.mockResolvedValue({ data: { user: user(), session: null }, error: null });
  expect((await confirm(request(link()))).status).toBe(401);
  expect(mocks.commit).not.toHaveBeenCalled();
});
it("refuses unconfirmed and anonymous accounts", async () => {
  for (const over of [{ email_confirmed_at: null }, { is_anonymous: true }]) {
    mocks.getUser.mockResolvedValue({ data: { user: user(over) }, error: null });
    expect((await confirm(request(link()))).status).toBe(401);
  }
  expect(mocks.commit).not.toHaveBeenCalled();
});
it("reports an unreachable auth service as unavailable, not as a bad link", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { name: "AuthRetryableFetchError", status: 0 } });
  expect((await confirm(request(link()))).status).toBe(503);
  expect(mocks.commit).not.toHaveBeenCalled();
});
it("rejects cross-origin requests, malformed tokens, unknown link types, extra fields and mixed bodies before calling Supabase", async () => {
  expect((await confirm(request(link(), "https://evil.example"))).status).toBe(403);
  for (const body of [link({ accessToken: "not-a-jwt" }), link({ refreshToken: "has spaces" }), link({ link: "signup" }), link({ extra: 1 }), { tokenHash: "a".repeat(64), accessToken: jwt, refreshToken: "x", link: "recovery" }, { accessToken: jwt, link: "recovery" }, {}])
    expect((await confirm(request(body))).status, JSON.stringify(Object.keys(body))).toBe(422);
  expect(mocks.getUser).not.toHaveBeenCalled(); expect(mocks.commit).not.toHaveBeenCalled();
});
it("still accepts the documented token_hash and only as a recovery verification", async () => {
  mocks.verifyOtp.mockResolvedValue({ data: { user: user() }, error: null });
  expect((await confirm(request({ tokenHash: "a".repeat(64) }))).status).toBe(200);
  expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: "a".repeat(64), type: "recovery" });
  mocks.verifyOtp.mockResolvedValue({ data: {}, error: { status: 403 } });
  expect((await confirm(request({ tokenHash: "a".repeat(64) }))).status).toBe(401);
});
