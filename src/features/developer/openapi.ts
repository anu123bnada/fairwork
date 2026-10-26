// The published description of the Developer API (module 21). It documents only what exists and is tested; there is no
// example that returns real data and no key or secret appears here. docs/ORYQEN_DEVELOPER_API.md is the prose companion.
const error = (description: string) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } });

export function developerOpenApi(origin: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "ORYQEN Developer API",
      version: "1.0.0",
      description: "Server-to-server verification of ORYQEN credentials, and signed webhook events. A valid result means ORYQEN issued the credential, it is unaltered, unexpired and its source record still stands. It does not mean a person or employer is trustworthy; reviewed credentials carry a demonstration-authority caveat that must be shown to end users.",
    },
    servers: [{ url: origin }],
    security: [{ developerKey: [] }],
    paths: {
      "/api/v1/developer/credentials/verify": {
        post: {
          operationId: "verifyCredential",
          summary: "Verify a credential",
          description: "Requires a developer key with the credentials:verify scope. Limited to 60 successful checks per minute per key and 120 attempts per minute per caller address. Missing, malformed, wrong, revoked or out-of-scope keys all receive the same 401.",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", additionalProperties: false, required: ["credential"], properties: { credential: { type: "string", minLength: 100, maxLength: 4096, description: "The token from the credential's QR code or link fragment." } } } } } },
          responses: {
            "200": { description: "Verification result", content: { "application/json": { schema: { type: "object", required: ["data"], properties: { data: { $ref: "#/components/schemas/VerificationResult" } } } } } },
            "401": error("The key is missing, malformed, wrong, revoked or lacks the scope. The answer never says which."),
            "422": error("The body is not valid."),
            "429": error("Rate limit reached."),
          },
        },
      },
    },
    webhooks: {
      "credential.revoked": { post: { summary: "A holder revoked a credential", requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookEvent" } } } }, responses: { "2XX": { description: "Acknowledge quickly. Retries reuse the same event id." } } } },
      ping: { post: { summary: "A manual test event", requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/WebhookEvent" } } } }, responses: { "2XX": { description: "Acknowledged." } } } },
    },
    components: {
      securitySchemes: { developerKey: { type: "http", scheme: "bearer", description: "A key of the form oryq_live_<key id>.<secret>, created by a signed-in person under Settings, Developer access. Never place it in a browser or mobile app." } },
      schemas: {
        Error: { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, requestId: { type: "string" } } } } },
        VerificationResult: {
          type: "object", required: ["valid", "state"],
          properties: {
            valid: { type: "boolean" },
            state: { type: "string", enum: ["valid", "revoked", "expired", "unknown", "not_verified"] },
            reason: { type: ["string", "null"] },
            checkedAt: { type: "string", format: "date-time" },
            credential: { type: "object", description: "Present only when the signature verifies. Exactly what the credential already disclosed to its holder; no account or record id.", properties: { id: { type: "string", format: "uuid" }, statement: { type: "string" }, claimType: { type: "string" }, assurance: { type: "string" }, assuranceAt: { type: "string" }, caveat: { type: "string" }, issuedAt: { type: "string", format: "date-time" }, expiresAt: { type: "string", format: "date-time" }, issuer: { type: "string" } } },
          },
        },
        WebhookEvent: {
          type: "object", required: ["id", "type", "createdAt", "data"],
          description: "Signed with header Oryqen-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of the text <t>.<raw body> with the endpoint secret>. Also sent: Oryqen-Event-Id and Oryqen-Event-Type. Reject timestamps more than 5 minutes from your clock and ignore event ids you have already processed.",
          properties: { id: { type: "string", format: "uuid" }, type: { type: "string", enum: ["credential.revoked", "ping"] }, createdAt: { type: "string", format: "date-time" }, data: { type: "object" } },
        },
      },
    },
  } as const;
}
