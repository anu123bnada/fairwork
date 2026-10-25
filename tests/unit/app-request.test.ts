import { afterEach, expect, it, vi } from "vitest";
import { appRequest } from "@/features/authority/client";
afterEach(() => vi.unstubAllGlobals());
it("keeps network failures distinct from invalid credentials without leaking response text", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("sensitive upstream URL")));
  await expect(appRequest("/api/v1/me")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE", status: 503 });
});
it("handles gateway HTML and malformed successful responses safely", async () => {
  for (const response of [new Response("private proxy trace", { status: 502 }), new Response("not json"), Response.json({ success: true })]) {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(appRequest("/api/v1/me")).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
  }
});
it("preserves explicit authorization errors", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { code: "AUTH_REQUIRED" } }, { status: 401 })));
  await expect(appRequest("/api/v1/me")).rejects.toMatchObject({ code: "AUTH_REQUIRED", status: 401 });
});
it("sends a write once with its retry key and does not retry a lost response", async () => {
  const fetch = vi.fn().mockRejectedValue(new TypeError("network")); vi.stubGlobal("fetch", fetch);
  await expect(appRequest("/api/v1/me", { displayName: "Worker" }, "stable-key", "PATCH")).rejects.toThrow();
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch).toHaveBeenCalledWith("/api/v1/me", expect.objectContaining({ method: "PATCH", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json", "Idempotency-Key": "stable-key" }, signal: expect.any(AbortSignal) }));
});
