import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { assertSameOrigin } from "@/server/http";
import { AppError, errorMessages } from "@/lib/errors";

const OFFICIAL = "https://oryqen-staging.vercel.app";
const req = (headers: Record<string, string>, url = `${OFFICIAL}/api/v1/auth/sign-in`) => new Request(url, { method: "POST", headers });
const outcome = (request: Request) => { try { assertSameOrigin(request); return "allowed"; } catch (error) { return error instanceof AppError ? `${error.status} ${error.code}` : "other"; } };
beforeEach(() => { vi.stubEnv("APP_ORIGIN", OFFICIAL); vi.stubEnv("FAIRWORK_DATA_MODE", "supabase"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_configuration_test"); });
afterEach(() => vi.unstubAllEnvs());

it("allows the official origin and nothing else", () => {
  expect(outcome(req({ origin: OFFICIAL }))).toBe("allowed");
  expect(outcome(req({ origin: OFFICIAL, "sec-fetch-site": "same-origin" }))).toBe("allowed");
});
it("refuses a cross-site browser request even from the official origin string", () => {
  expect(outcome(req({ origin: OFFICIAL, "sec-fetch-site": "cross-site" }))).toBe("403 ACTION_FORBIDDEN");
});
it("refuses a missing or foreign Origin with the plain forbidden answer and no explanation", () => {
  expect(outcome(req({}))).toBe("403 ACTION_FORBIDDEN");
  expect(outcome(req({ origin: "https://evil.example" }))).toBe("403 ACTION_FORBIDDEN");
  expect(outcome(req({ origin: "https://oryqen-staging.vercel.app.evil.example" }))).toBe("403 ACTION_FORBIDDEN");
  expect(outcome(req({ origin: "null" }))).toBe("403 ACTION_FORBIDDEN");
});
it("still refuses, but explains, when the person is on another hostname of this same deployment", () => {
  const branchHost = "https://oryqen-git-release-oryqen-oct27-vehiview-6817s-projects.vercel.app";
  expect(outcome(req({ origin: branchHost, "sec-fetch-site": "same-origin" }, `${branchHost}/api/v1/auth/sign-in`))).toBe("403 WRONG_ORIGIN");
  expect(outcome(req({ origin: branchHost }, `${branchHost}/api/v1/auth/sign-in`))).toBe("403 WRONG_ORIGIN");
  // an attacker page posting to the deployment cannot claim the deployment's own origin: the browser sets Origin to the attacker's site
  expect(outcome(req({ origin: "https://evil.example" }, `${branchHost}/api/v1/auth/sign-in`))).toBe("403 ACTION_FORBIDDEN");
  expect(outcome(req({ origin: branchHost, "sec-fetch-site": "cross-site" }, `${branchHost}/api/v1/auth/sign-in`))).toBe("403 ACTION_FORBIDDEN");
});
it("tells the person what to do without naming any address or secret", () => {
  expect(errorMessages.WRONG_ORIGIN).toMatch(/official address/);
  expect(errorMessages.WRONG_ORIGIN).not.toMatch(/https?:|vercel|supabase/i);
});
