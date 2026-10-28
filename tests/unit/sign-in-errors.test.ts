import { beforeEach, afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signInWithPassword: vi.fn(), signOut: vi.fn(), rpc: vi.fn() }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: async () => ({ auth: { signInWithPassword: mocks.signInWithPassword, signOut: mocks.signOut }, rpc: mocks.rpc }) }));
vi.mock("@/server/telemetry", () => ({ recordRuntimeEvent: async () => undefined }));
import { POST as signIn } from "@/app/api/v1/auth/sign-in/route";
import { errorMessages } from "@/lib/errors";

const request = (body: unknown, origin = "http://127.0.0.1:3100") => new Request("http://127.0.0.1:3100/api/v1/auth/sign-in", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
const CREDENTIALS = { email: "someone@example.test", password: "synthetic-password-1" };
beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100"); vi.stubEnv("FAIRWORK_DATA_MODE", "synthetic"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_configuration_test"); });
afterEach(() => vi.unstubAllEnvs());

it("tells a person with the right password but an unconfirmed email to confirm it, instead of 'Sign in to continue.'", async () => {
  mocks.signInWithPassword.mockResolvedValue({ data: null, error: { status: 400, code: "email_not_confirmed", message: "Email not confirmed" } });
  const response = await signIn(request(CREDENTIALS)); const body = await response.json();
  expect(response.status).toBe(401); expect(body.error.code).toBe("EMAIL_NOT_CONFIRMED"); expect(body.error.message).toBe(errorMessages.EMAIL_NOT_CONFIRMED);
});
it("says the email and password do not match, identically for a wrong password and an unknown address", async () => {
  for (const code of ["invalid_credentials"]) {
    mocks.signInWithPassword.mockResolvedValue({ data: null, error: { status: 400, code, message: "Invalid login credentials" } });
    const response = await signIn(request(CREDENTIALS)); const body = await response.json();
    expect([response.status, body.error.code, body.error.message]).toEqual([401, "INVALID_CREDENTIALS", errorMessages.INVALID_CREDENTIALS]);
  }
  for (const code of ["user_not_found", undefined]) {
    mocks.signInWithPassword.mockResolvedValue({ data: null, error: { status: 400, code, message: "Invalid login credentials" } });
    const response = await signIn(request(CREDENTIALS)); const body = await response.json();
    expect([response.status, body.error.code]).toEqual([401, "AUTH_REQUIRED"]);
  }
});
it("is reachable with no session at all: the handler itself calls the provider, and the session proxy does not guard the sign-in routes", async () => {
  const { config } = await import("@/proxy");
  for (const path of ["/api/v1/auth/sign-in", "/api/v1/auth/register", "/api/v1/auth/recover", "/api/v1/auth/confirm"]) expect(config.matcher.some(m => new RegExp(`^${m.replace(/:path\*/, ".*")}$`).test(path)), path).toBe(false);
  mocks.signInWithPassword.mockResolvedValue({ data: { user: { id: "00000000-0000-4000-8000-000000000001" } }, error: null });
  mocks.rpc.mockResolvedValue({ data: { access: "active" }, error: null });
  const response = await signIn(request(CREDENTIALS));
  expect(mocks.signInWithPassword).toHaveBeenCalledWith(CREDENTIALS);
  expect([response.status, (await response.json()).data]).toEqual([200, { signedIn: true }]);
});
it("reports a rate limit as 429 and an unreachable provider as 503", async () => {
  mocks.signInWithPassword.mockResolvedValue({ data: null, error: { status: 429, code: "over_request_rate_limit" } });
  expect((await signIn(request(CREDENTIALS))).status).toBe(429);
  mocks.signInWithPassword.mockResolvedValue({ data: null, error: { status: 0, name: "AuthRetryableFetchError" } });
  expect((await signIn(request(CREDENTIALS))).status).toBe(503);
});
it("refuses a foreign origin before touching the provider", async () => {
  expect((await signIn(request(CREDENTIALS, "https://evil.example"))).status).toBe(403);
  expect(mocks.signInWithPassword).not.toHaveBeenCalled();
});
it("rejects malformed bodies without calling the provider", async () => {
  for (const body of [{}, { email: "not-an-email", password: "x" }, { ...CREDENTIALS, extra: 1 }, { email: CREDENTIALS.email }]) expect((await signIn(request(body))).status, JSON.stringify(Object.keys(body))).toBe(422);
  expect(mocks.signInWithPassword).not.toHaveBeenCalled();
});
