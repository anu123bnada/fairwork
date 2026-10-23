import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ signUp: vi.fn(), resend: vi.fn(), verifyOtp: vi.fn(), createClient: vi.fn(), createServer: vi.fn() }));
vi.mock("@supabase/supabase-js", () => ({ createClient: mocks.createClient }));
vi.mock("@/server/supabase", () => ({ createServerSupabase: mocks.createServer }));
import { POST as register } from "@/app/api/v1/auth/register/route";
import { POST as confirm } from "@/app/api/v1/auth/confirm/route";
import { POST as resend } from "@/app/api/v1/auth/resend/route";

const credentials = { email: "new@example.test", password: "synthetic-password-only" };
const tokenHash = "a".repeat(64);
const req = (body: unknown, origin = "https://app.example.test") => new Request("https://app.example.test/api/v1/auth/register", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });
const settings = { disable_signup: false, mailer_autoconfirm: false, external: { email: true, anonymous_users: false } };
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_ORIGIN", "https://app.example.test"); vi.stubEnv("FAIRWORK_DATA_MODE", "synthetic");
  vi.stubEnv("AUTH_REGISTRATION_ENABLED", "true"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic_configuration_test");
  vi.stubGlobal("fetch", vi.fn(async () => Response.json(settings)));
  mocks.createClient.mockReturnValue({ auth: { signUp: mocks.signUp, resend: mocks.resend } });
  mocks.resend.mockResolvedValue({ error: null });
  mocks.createServer.mockResolvedValue({ auth: { verifyOtp: mocks.verifyOtp } });
  mocks.signUp.mockResolvedValue({ data: { session: null }, error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
describe("disabled-by-default real registration and email confirmation", () => {
  it("carries a validated destination in email callbacks and only display metadata", async () => {
    const continuation = "offerId=40000000-0000-4000-8000-000000000003&workspace=employer";
    expect((await register(req({ ...credentials, displayName: "Synthetic employer", continuation }))).status).toBe(200);
    expect(mocks.signUp).toHaveBeenCalledWith({ ...credentials, options: { emailRedirectTo: `https://app.example.test/auth/confirm?${continuation}`, data: { display_name: "Synthetic employer" } } });
    for (const bad of ["https://evil.invalid", "workspace=operator", "workspace=employer&role=ADMIN", "offerId=invalid", "workspace=employer&workspace=employer"]) {
      expect((await register(req({ ...credentials, continuation: bad }))).status).toBe(422);
      expect((await resend(req({ email: credentials.email, continuation: bad }))).status).toBe(422);
    }
  });
  it("resends only signup verification with generic outcomes, origin checks and provider limits", async () => {
    expect((await resend(req({ email: credentials.email }, "https://evil.invalid"))).status).toBe(403);
    expect(mocks.resend).not.toHaveBeenCalled();
    for (const error of [null, { status: 400 }]) {
      mocks.resend.mockResolvedValue({ error });
      const response = await resend(req({ email: credentials.email, continuation: "workspace=employer" }));
      expect(response.status).toBe(200);
      expect((await response.json()).data).toEqual({ verificationRequired: true });
    }
    expect(mocks.resend).toHaveBeenCalledWith({ type: "signup", email: credentials.email, options: { emailRedirectTo: "https://app.example.test/auth/confirm?workspace=employer" } });
    for (const status of [429, 503]) {
      mocks.resend.mockResolvedValue({ error: { status } });
      expect((await resend(req({ email: credentials.email }))).status).toBe(status);
    }
    vi.stubEnv("AUTH_REGISTRATION_ENABLED", "false");
    expect((await resend(req({ email: credentials.email }))).status).toBe(403);
  });
  it("blocks both mutations while disabled without touching provider", async () => {
    vi.stubEnv("AUTH_REGISTRATION_ENABLED", "false");
    expect((await register(req(credentials))).status).toBe(403);
    expect((await confirm(req({ tokenHash }))).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled(); expect(mocks.createServer).not.toHaveBeenCalled();
  });
  it("denies cross-origin registration and confirmation", async () => {
    expect((await register(req(credentials, "https://evil.example"))).status).toBe(403);
    expect((await confirm(req({ tokenHash }, "https://evil.example"))).status).toBe(403);
    expect(mocks.createClient).not.toHaveBeenCalled(); expect(mocks.createServer).not.toHaveBeenCalled();
  });
  it("requires an explicit canonical origin and HTTPS in production", async () => {
    vi.stubEnv("APP_ORIGIN", "");
    expect((await register(req(credentials))).status).toBe(503);
    vi.stubEnv("APP_ORIGIN", "http://localhost:3000"); vi.stubEnv("NODE_ENV", "production");
    expect((await register(req(credentials, "http://localhost:3000"))).status).toBe(503);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("fails closed on network failures and malformed settings", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("private-network-detail"); }));
    expect((await register(req(credentials))).status).toBe(503);
    vi.stubGlobal("fetch", vi.fn(async () => new Response("invalid")));
    expect((await register(req(credentials))).status).toBe(503);
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("rejects role/authority injection and short passwords before provider calls", async () => {
    for (const body of [{ ...credentials, role: "EMPLOYER" }, { ...credentials, companyId: crypto.randomUUID() }, { ...credentials, password: "short" }]) expect((await register(req(body))).status).toBe(422);
    expect(mocks.createClient).not.toHaveBeenCalled();
  });
  it("uses only the canonical callback, never stores or returns signup tokens", async () => {
    const response = await register(req(credentials));
    expect(response.status).toBe(200); expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect((await response.json()).data).toEqual({ verificationRequired: true });
    expect(mocks.signUp).toHaveBeenCalledWith({ ...credentials, options: { emailRedirectTo: "https://app.example.test/auth/confirm" } });
    expect(mocks.createClient.mock.calls[0]![2].auth).toEqual({ persistSession: false, autoRefreshToken: false, detectSessionInUrl: false });
  });
  it("fails closed on disabled, unknown or auto-confirm provider policy", async () => {
    for (const data of [{}, { ...settings, disable_signup: true }, { ...settings, mailer_autoconfirm: true }, { ...settings, external: { email: true, anonymous_users: true } }]) {
      vi.stubGlobal("fetch", vi.fn(async () => Response.json(data)));
      expect((await register(req(credentials))).status).toBe(503);
    }
    expect(mocks.signUp).not.toHaveBeenCalled();
  });
  it("does not expose an unexpected auto-confirm session", async () => {
    mocks.signUp.mockResolvedValue({ data: { session: { access_token: "secret" } }, error: null });
    const response = await register(req(credentials)); expect(response.status).toBe(503); expect(await response.text()).not.toContain("secret");
  });
  it("keeps existing and newly registered accounts indistinguishable", async () => {
    const first = await (await register(req(credentials))).json();
    mocks.signUp.mockResolvedValue({ data: {}, error: { status: 422, code: "user_already_exists", message: "private detail" } });
    const second = await (await register(req(credentials))).json();
    expect(first.data).toEqual(second.data);
  });
  it("maps provider limits and failures without provider details", async () => {
    for (const [status, expected] of [[429, 429], [503, 503], [400, 422]]) {
      mocks.signUp.mockResolvedValue({ data: {}, error: { status, message: "private detail" } });
      const response = await register(req(credentials)); expect(response.status).toBe(expected); expect(await response.text()).not.toContain("private detail");
    }
  });
  it("confirms a real email token with cookie writes but never returns a session", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { user: { email_confirmed_at: "2026-10-16", is_anonymous: false }, session: { access_token: "secret" } }, error: null });
    const response = await confirm(req({ tokenHash })); expect(response.status).toBe(200);
    expect(mocks.createServer).toHaveBeenCalledWith(true);
    expect(mocks.verifyOtp).toHaveBeenCalledWith({ token_hash: tokenHash, type: "email" });
    expect((await response.json()).data).toEqual({ confirmed: true });
  });
  it("rejects expired/replayed tokens, arbitrary verification types and redirects", async () => {
    mocks.verifyOtp.mockResolvedValue({ data: { user: null }, error: { status: 403, message: "secret token" } });
    const response = await confirm(req({ tokenHash })); expect(response.status).toBe(401); expect(await response.text()).not.toContain("secret token");
    for (const body of [{ tokenHash, type: "recovery" }, { tokenHash, next: "https://evil.example" }, { tokenHash: "invalid" }]) expect((await confirm(req(body))).status).toBe(422);
  });
});
