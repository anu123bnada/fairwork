import { beforeEach, afterEach, expect, it, vi } from "vitest";
// The hosted failure report: a real reset email, matching passwords, and "Check the supplied fields." The identity provider refuses some new passwords
// for reasons the person can fix; the app must answer with the reason, from the provider's stable error CODE only, and never echo its message.
const mocks = vi.hoisted(() => ({ getUser: vi.fn(), getAuthenticatorAssuranceLevel: vi.fn(), updateUser: vi.fn(), signOut: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { ...mocks, mfa: mocks } }), createStagedServerSupabase: async () => { throw new Error("not used"); } }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ auth: mocks }) }));
import { POST as updatePassword } from "@/app/api/v1/auth/password/route";
import { errorMessages } from "@/lib/errors";

const request = (body: unknown) => new Request("http://127.0.0.1:3100/api/v1/auth/password", { method: "POST", headers: { origin: "http://127.0.0.1:3100", "content-type": "application/json" }, body: JSON.stringify(body) });
const GOOD = { password: "synthetic-new-password" };
beforeEach(() => {
  vi.resetAllMocks(); vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100"); vi.stubEnv("FAIRWORK_DATA_MODE", "synthetic");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_configuration_test");
  mocks.getUser.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-10-18", is_anonymous: false, id: "u" } }, error: null });
  mocks.getAuthenticatorAssuranceLevel.mockResolvedValue({ data: { currentLevel: "aal1", nextLevel: "aal1" }, error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());

for (const [code, status, appCode] of [
  ["same_password", 422, "SAME_PASSWORD"], ["weak_password", 422, "WEAK_PASSWORD"],
  ["session_not_found", 401, "RESET_EXPIRED"], ["session_expired", 401, "RESET_EXPIRED"], ["bad_jwt", 401, "RESET_EXPIRED"], ["reauthentication_needed", 401, "RESET_EXPIRED"], ["refresh_token_already_used", 401, "RESET_EXPIRED"],
  ["insufficient_aal", 403, "MFA_REQUIRED"],
] as const) {
  it(`maps the provider code ${code} to ${appCode} (${status}) without echoing its message, and never signs the person out on a refusal`, async () => {
    mocks.updateUser.mockResolvedValue({ error: { status: 422, code, message: "internal provider detail: user 40000000 hash $2a$ leak" } });
    const response = await updatePassword(request(GOOD));
    const body = await response.json();
    expect(response.status).toBe(status);
    expect(body.error.code).toBe(appCode);
    expect(body.error.message).toBe(errorMessages[appCode]);
    expect(JSON.stringify(body)).not.toContain("leak");
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
}
it("still answers the generic field message for a refusal it does not recognise, and 503 for an outage, 429 for a rate limit", async () => {
  mocks.updateUser.mockResolvedValue({ error: { status: 422, code: "something_new" } });
  expect((await updatePassword(request(GOOD))).status).toBe(422);
  mocks.updateUser.mockResolvedValue({ error: { status: 429, code: "over_request_rate_limit" } });
  expect((await updatePassword(request(GOOD))).status).toBe(429);
  mocks.updateUser.mockResolvedValue({ error: { status: 0, name: "AuthRetryableFetchError" } });
  expect((await updatePassword(request(GOOD))).status).toBe(503);
});
it("changes the password and ends every session on success, as before", async () => {
  mocks.updateUser.mockResolvedValue({ error: null });
  const response = await updatePassword(request(GOOD));
  expect(response.status).toBe(200); expect(mocks.signOut).toHaveBeenCalledWith({ scope: "global" });
});
it("refuses a short password before calling the provider", async () => {
  expect((await updatePassword(request({ password: "short" }))).status).toBe(422);
  expect(mocks.updateUser).not.toHaveBeenCalled();
});
