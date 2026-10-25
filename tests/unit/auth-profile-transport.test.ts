import { afterEach, beforeEach, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => new Map<string, string>());
vi.mock("next/headers", () => ({ cookies: async () => ({
  getAll: () => [...jar].map(([name, value]) => ({ name, value })),
  set: (name: string, value: string) => jar.set(name, value),
}) }));
import { POST as signIn } from "@/app/api/v1/auth/sign-in/route";
import { POST as createProfile, GET as getProfile } from "@/app/api/v1/me/route";

const origin = "https://oryqen-staging.vercel.app";
const id = "40000000-0000-4000-8000-000000000001";
const user = { id, email_confirmed_at: "2026-10-25", is_anonymous: false };
const dto = { id, displayName: "Transport test", locale: "en", timeZone: "Asia/Colombo", revision: 1, capabilities: [] };
const input = { displayName: dto.displayName, locale: dto.locale, timeZone: dto.timeZone };
const token = ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify({ sub: id, exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url"), "synthetic"].join(".");
const credentials = { email: "transport@example.test", password: "synthetic-password" };
function request(path: string, body: unknown, requestOrigin = origin, key = id) {
  return new Request(origin + path, { method: "POST", headers: {
    origin: requestOrigin, "content-type": "application/json", "idempotency-key": key,
  }, body: JSON.stringify(body) });
}
let rpcResponse: () => Response;
let rpcCalls: { url: string; headers: Headers; body: unknown }[];
beforeEach(() => {
  jar.clear(); rpcCalls = []; rpcResponse = () => Response.json(dto);
  vi.stubEnv("APP_ORIGIN", origin); vi.stubEnv("FAIRWORK_DATA_MODE", "supabase");
  vi.stubEnv("AUTH_REGISTRATION_ENABLED", "false");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic_configuration_test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    const path = new URL(String(url)).pathname;
    if (path === "/auth/v1/token") return Response.json({ access_token: token, refresh_token: "synthetic-refresh", expires_in: 3600, token_type: "bearer", user });
    if (path === "/auth/v1/user") return Response.json(user);
    if (path === "/rest/v1/rpc/account_access") return Response.json({ access: "needs_profile" });
    if (path.startsWith("/rest/v1/rpc/")) {
      rpcCalls.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
      return rpcResponse();
    }
    throw new Error("Unexpected test request");
  }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function login() {
  const response = await signIn(request("/api/v1/auth/sign-in", credentials));
  expect(response.status).toBe(200);
  expect((await response.json()).data).toEqual({ signedIn: true, profileRequired: true });
  expect(jar.size).toBeGreaterThan(0);
}

it("signs in with registration disabled and carries SSR cookies into scalar profile RPCs", async () => {
  await login();
  const created = await createProfile(request("/api/v1/me", input));
  expect(created.status).toBe(200);
  expect((await created.json()).data).toEqual(dto);
  expect(rpcCalls[0]!.body).toEqual({ request: { ...input, idempotencyKey: id } });
  const headers = rpcCalls[0]!.headers;
  expect(headers.get("content-profile")).toBe("api");
  expect(headers.get("content-type")).toBe("application/json");
  // The unmodified SDK leaves Accept unset: fetch negotiates */*, not a singular row.
  expect(headers.get("accept")).toBeNull();
  expect(headers.get("authorization")).toBe(`Bearer ${token}`);
  expect((await getProfile(new Request(origin + "/api/v1/me"))).status).toBe(200);
});

it.each(["PGRST106", "PGRST107", "PGRST116"])("preserves upstream 406/%s privately with the application request ID", async code => {
  await login();
  rpcResponse = () => Response.json({ code, message: "private provider text", details: "private row", hint: "private hint" }, { status: 406 });
  const response = await createProfile(request("/api/v1/me", input));
  expect(response.status).toBe(503);
  expect((await response.json()).error.code).toBe("SERVICE_UNAVAILABLE");
  expect(console.error).toHaveBeenCalledWith("[ORYQEN_PROFILE_RPC_DIAGNOSTIC]", JSON.stringify({
    command: "create_profile", requestId: response.headers.get("x-request-id"), phase: "rpc", code, status: 406,
  }));
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("private");
});

it.each([null, [dto], { create_profile: dto }])("rejects an unexpected successful RPC shape without unwrapping it", async data => {
  await login(); rpcResponse = () => Response.json(data);
  const response = await createProfile(request("/api/v1/me", input));
  expect(response.status).toBe(500);
  expect(console.error).toHaveBeenCalledWith("[ORYQEN_PROFILE_RPC_DIAGNOSTIC]", JSON.stringify({
    command: "create_profile", requestId: response.headers.get("x-request-id"), phase: "response_schema", status: 200,
  }));
});

it.each([["P0001", "RATE_LIMITED", 429], ["P0001", "IDEMPOTENCY_CONFLICT", 409], ["42501", "private permission error", 403]])("preserves controlled database failure mapping (%s/%s)", async (code, message, expected) => {
  await login(); rpcResponse = () => Response.json({ code, message }, { status: 400 });
  expect((await createProfile(request("/api/v1/me", input))).status).toBe(expected);
});

it("rejects missing sessions, invalid idempotency and forged fields before the profile RPC", async () => {
  expect((await createProfile(request("/api/v1/me", input))).status).toBe(401);
  await login();
  expect((await createProfile(request("/api/v1/me", input, origin, "invalid"))).status).toBe(422);
  expect((await createProfile(request("/api/v1/me", { ...input, id }))).status).toBe(422);
  expect(rpcCalls).toEqual([]);
});

it("rejects a Preview alias origin before password authentication", async () => {
  const response = await signIn(request("/api/v1/auth/sign-in", credentials, "https://oryqen-other.vercel.app"));
  expect(response.status).toBe(403);
  expect((await response.json()).error.code).toBe("ACTION_FORBIDDEN");
  expect(fetch).not.toHaveBeenCalled();
});
