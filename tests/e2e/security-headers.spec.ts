import { expect, test } from "@playwright/test";

// Every response carries the same baseline headers, including pages, API errors and the credential key endpoint.
for (const path of ["/", "/sign-in", "/verify", "/api/v1/me", "/api/v1/credentials/status?id=not-a-uuid", "/.well-known/oryqen-keys.json"]) {
  test(`security headers are present on ${path}`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    const headers = response.headers();
    expect(headers["strict-transport-security"]).toMatch(/max-age=31536000/);
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("no-referrer");
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(headers["permissions-policy"]).toContain("camera=()");
    expect(headers["x-powered-by"]).toBeUndefined();
  });
}

test("API responses are never cached and never reveal a stack trace or provider name", async ({ request }) => {
  const response = await request.get("/api/v1/me");
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const text = await response.text();
  expect(text).not.toMatch(/at .*\(.*:\d+:\d+\)|node_modules|supabase\.co|postgres/i);
});
