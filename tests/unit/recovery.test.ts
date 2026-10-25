import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ resetPasswordForEmail: vi.fn(), verifyOtp: vi.fn(), getUser: vi.fn(), getAuthenticatorAssuranceLevel: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: mocks }) }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { ...mocks, mfa: mocks } }) }));
import { POST as requestRecovery } from "@/app/api/v1/auth/recovery/route";
import { POST as confirm } from "@/app/api/v1/auth/recovery/confirm/route";
import { POST as updatePassword } from "@/app/api/v1/auth/password/route";
const request = (body: unknown, origin = "http://127.0.0.1:3100") => new Request("http://127.0.0.1:3100/api/v1/auth/recovery", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100"); vi.stubEnv("FAIRWORK_DATA_MODE", "synthetic");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_configuration_test");
  mocks.getUser.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-10-18", is_anonymous: false } }, error: null });
  mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  mocks.updateUser.mockResolvedValue({ error: null }); mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
it("does not claim recovery email was requested during a provider network outage", async () => {
  mocks.resetPasswordForEmail.mockResolvedValue({ error: { name: "AuthRetryableFetchError", status: 0 } });
  expect((await requestRecovery(request({ email: "local@example.test" }))).status).toBe(503);
  mocks.verifyOtp.mockResolvedValue({ data: {}, error: { name: "AuthRetryableFetchError", status: 0 } });
  expect((await confirm(request({ tokenHash: "a".repeat(64) }))).status).toBe(503);
});
it("rejects cross-origin recovery and extra trusted fields", async () => {
  expect((await requestRecovery(request({ email: "local@example.test" }, "https://evil.example"))).status).toBe(403);
  expect((await requestRecovery(request({ email: "local@example.test", redirectTo: "https://evil.example" }))).status).toBe(422);
  expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
});
it("uses canonical callback and does not reveal account existence", async () => {
  for (const error of [null, { status: 400, message: "unknown private account" }]) {
    mocks.resetPasswordForEmail.mockResolvedValue({ error });
    expect((await (await requestRecovery(request({ email: "local@example.test" }))).json()).data).toEqual({ requested: true });
  }
  expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("local@example.test", { redirectTo: "http://127.0.0.1:3100/auth/recover" });
});
it("preserves a validated recovery destination and rejects injected redirects", async () => {
  mocks.resetPasswordForEmail.mockResolvedValue({ error: null });
  expect((await requestRecovery(request({ email: "local@example.test", continuation: "workspace=employer" }))).status).toBe(200);
  expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("local@example.test", { redirectTo: "http://127.0.0.1:3100/auth/recover?workspace=employer" });
  expect((await requestRecovery(request({ email: "local@example.test", continuation: "next=https://evil.invalid" }))).status).toBe(422);
});
it("accepts only recovery verification and rejects replayed tokens", async () => {
  mocks.verifyOtp.mockResolvedValue({ data: {}, error: { status: 403 } });
  const tokenHash = "a".repeat(64);
  expect((await confirm(request({ tokenHash }))).status).toBe(401);
  expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: tokenHash, type: "recovery" });
  expect((await confirm(request({ tokenHash, type: "email" }))).status).toBe(422);
});
it("never lets email recovery bypass an existing MFA factor", async () => {
  mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal2" }, error: null });
  expect((await updatePassword(request({ password: "synthetic-new-password" }))).status).toBe(403);
  expect(mocks.updateUser).not.toHaveBeenCalled();
});
it("requires verified identity and strong password input", async () => {
  expect((await updatePassword(request({ password: "short" }))).status).toBe(422);
  mocks.getUser.mockResolvedValue({ data: { user: null }, error: { status: 401 } });
  expect((await updatePassword(request({ password: "synthetic-new-password" }))).status).toBe(401);
  expect(mocks.updateUser).not.toHaveBeenCalled();
});
it("changes password and revokes refresh sessions without returning tokens", async () => {
  const response = await updatePassword(request({ password: "synthetic-new-password" }));
  expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
  expect((await response.json()).data).toEqual({ updated: true, signInRequired: true });
});
