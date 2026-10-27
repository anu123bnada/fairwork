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
it("gives the same plain answer for wrong passwords and unknown addresses, so nothing about other accounts is revealed", async () => {
  for (const code of ["invalid_credentials", "user_not_found", undefined]) {
    mocks.signInWithPassword.mockResolvedValue({ data: null, error: { status: 400, code, message: "Invalid login credentials" } });
    const response = await signIn(request(CREDENTIALS)); const body = await response.json();
    expect([response.status, body.error.code]).toEqual([401, "AUTH_REQUIRED"]);
  }
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
