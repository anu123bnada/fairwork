import { z } from "zod";

// The caller's own server-observed security events (module 12). Kind and time only; the telemetry keeps no address, device or request content.
export const securityEventKind = z.enum(["login_success", "mfa_success", "logout_success", "password_changed"]);
export const securityEvents = z.strictObject({
  items: z.array(z.strictObject({ kind: securityEventKind, occurredAt: z.string() })).max(30),
  limit: z.literal(30),
});
export type SecurityEvents = z.infer<typeof securityEvents>;
