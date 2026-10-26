import { describe, expect, it } from "vitest";
import { developerOpenApi } from "@/features/developer/openapi";
import { verifyRequest } from "@/features/developer/keys";

describe("developer OpenAPI document", () => {
  const doc = developerOpenApi("https://oryqen.example");
  it("describes exactly the endpoint and events that exist", () => {
    expect(doc.openapi).toBe("3.1.0");
    expect(Object.keys(doc.paths)).toEqual(["/api/v1/developer/credentials/verify"]);
    expect(Object.keys(doc.webhooks)).toEqual(["credential.revoked", "ping"]);
    expect(doc.paths["/api/v1/developer/credentials/verify"].post.responses).toHaveProperty("401");
  });
  it("matches the request schema the server enforces", () => {
    const body = doc.paths["/api/v1/developer/credentials/verify"].post.requestBody.content["application/json"].schema;
    expect(body.required).toEqual(["credential"]);
    expect(body.properties.credential).toMatchObject({ minLength: 100, maxLength: 4096 });
    expect(verifyRequest.safeParse({ credential: "x".repeat(99) }).success).toBe(false);
    expect(verifyRequest.safeParse({ credential: "x".repeat(100) }).success).toBe(true);
    expect(verifyRequest.safeParse({ credential: "x".repeat(100), extra: 1 }).success).toBe(false);
  });
  it("carries no secrets, only the bearer scheme", () => {
    const text = JSON.stringify(doc);
    expect(text).not.toMatch(/oryq_live_[0-9a-f-]{36}\./);
    expect(text).not.toMatch(/BEGIN [A-Z ]*PRIVATE KEY/);
    expect(doc.components.securitySchemes.developerKey).toMatchObject({ type: "http", scheme: "bearer" });
  });
  it("lists the same verification states the verifier can return", () => {
    expect(doc.components.schemas.VerificationResult.properties.state.enum).toEqual(["valid", "revoked", "expired", "unknown", "not_verified"]);
  });
});
