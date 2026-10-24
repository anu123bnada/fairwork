import { afterEach, beforeEach, expect, it, vi } from "vitest";
const jar = vi.hoisted(() => ({ values: new Map<string, string>(), set: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ getAll: () => [...jar.values].map(([name, value]) => ({ name, value })), set: jar.set }) }));
import { POST } from "@/app/api/v1/auth/confirm/route";
import { createServerSupabase } from "@/server/supabase";

const user = { id: "40000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "synthetic@example.test", email_confirmed_at: "2026-10-24", is_anonymous: false, app_metadata: {}, user_metadata: {}, created_at: "2026-10-24" };
function jwt(marker: string) {
  return [Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url"), Buffer.from(JSON.stringify({ sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600, marker })).toString("base64url"), "synthetic-signature"].join(".");
}
const request = () => new Request("https://app.example.test/api/v1/auth/confirm", { method: "POST", headers: { origin: "https://app.example.test", "content-type": "application/json" }, body: JSON.stringify({ accessToken: jwt("original"), refreshToken: "synthetic-refresh" }) });
beforeEach(() => {
  jar.values.clear(); jar.set.mockReset();
  jar.set.mockImplementation((name: string, value: string) => jar.values.set(name, value));
  vi.stubEnv("APP_ORIGIN", "https://app.example.test"); vi.stubEnv("FAIRWORK_DATA_MODE", "synthetic");
  vi.stubEnv("AUTH_REGISTRATION_ENABLED", "true"); vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_synthetic_configuration_test");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("real SSR library commits rotated cookies only after validation and reopens an authenticated client", async () => {
  const refreshed = jwt("rotated");
  const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/token")) {
      expect(jar.set).not.toHaveBeenCalled();
      expect(JSON.parse(String(init?.body))).toEqual({ refresh_token: "synthetic-refresh" });
      return Response.json({ access_token: refreshed, refresh_token: "rotated-refresh", token_type: "bearer", expires_in: 3600, user });
    }
    return Response.json(user);
  });
  vi.stubGlobal("fetch", fetcher);
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect((await response.json()).data).toEqual({ confirmed: true });
  expect(jar.set).toHaveBeenCalled();
  expect(jar.set.mock.calls[0]![2]).toMatchObject({ secure: true, sameSite: "lax", path: "/" });
  const reopened = await createServerSupabase();
  const checked = await reopened.auth.getUser();
  expect(checked.data.user?.id).toBe(user.id);
  const headers = new Headers(fetcher.mock.calls.at(-1)![1]?.headers);
  expect(headers.get("Authorization")).toBe(`Bearer ${refreshed}`);
});

it("discards real SSR cookie writes on a mismatched refreshed identity", async () => {
  vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => String(input).includes("/token")
    ? Response.json({ access_token: jwt("other"), refresh_token: "other-refresh", token_type: "bearer", expires_in: 3600, user: { ...user, id: "40000000-0000-4000-8000-000000000002" } })
    : Response.json(user)));
  const response = await POST(request());
  expect(response.status).toBe(401);
  expect(jar.set).not.toHaveBeenCalled();
});
