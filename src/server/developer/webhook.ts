import "server-only";
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import dns from "node:dns";
import https from "node:https";
import { isIP } from "node:net";
import type { LookupFunction } from "node:net";

// Signed webhook delivery (module 21, docs/ORYQEN_DEVELOPER_API.md).
//  - Signature: header `Oryqen-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<body>" with the endpoint secret>`.
//    Receivers should reject a timestamp more than five minutes old and remember each `Oryqen-Event-Id` they have already
//    processed; together these stop a captured delivery from being replayed.
//  - Targets must be https and must resolve only to public addresses. The check runs at connection time, inside the TLS
//    socket's own DNS lookup, so a name that changes its answer between a check and a connection cannot reach a private network.
//  - Delivery is retried on network errors, 408, 429 and 5xx; other responses (including redirects) are final.
export const SIGNATURE_TOLERANCE_SECONDS = 300;
export const RETRY_DELAYS_MS = [0, 1000, 5000] as const;

export type WebhookEvent = { id: string; type: "ping" | "credential.revoked"; createdAt: string; data: Record<string, unknown> };
export const buildEvent = (type: WebhookEvent["type"], data: Record<string, unknown>, now: Date, id: string = randomUUID()): WebhookEvent => ({ id, type, createdAt: now.toISOString(), data });

export function signPayload(secret: string, body: string, timestampSeconds: number): string {
  return `t=${timestampSeconds},v1=${createHmac("sha256", secret).update(`${timestampSeconds}.${body}`).digest("hex")}`;
}
export function verifySignature(header: string | null | undefined, body: string, secret: string, nowSeconds: number, toleranceSeconds = SIGNATURE_TOLERANCE_SECONDS): boolean {
  const match = /^t=(\d{1,12}),v1=([0-9a-f]{64})$/.exec(header ?? "");
  if (!match) return false;
  const timestamp = Number(match[1]);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = Buffer.from(signPayload(secret, body, timestamp).split("v1=")[1]!, "hex"), given = Buffer.from(match[2]!, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// Addresses a webhook may never reach: loopback, private, link-local (including cloud metadata), carrier-grade NAT,
// documentation, multicast and reserved ranges, and the IPv6 equivalents (including IPv4-mapped forms).
export function isPublicAddress(address: string): boolean {
  const kind = isIP(address);
  if (kind === 4) {
    const [a, b] = address.split(".").map(Number) as [number, number, number, number];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || b === 0 || (b === 88))) return false;
    if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
    if (a === 203 && b === 0) return false;
    return true;
  }
  if (kind === 6) {
    const lower = address.toLowerCase();
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower) ?? /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
    if (mapped) return mapped[2] === undefined ? isPublicAddress(mapped[1]!) : isPublicAddress(`${parseInt(mapped[1]!, 16) >> 8}.${parseInt(mapped[1]!, 16) & 255}.${parseInt(mapped[2], 16) >> 8}.${parseInt(mapped[2], 16) & 255}`);
    if (lower === "::" || lower === "::1") return false;
    if (/^f[cd]/.test(lower) || /^fe[89ab]/.test(lower) || /^ff/.test(lower)) return false; // unique local, link local, multicast
    if (lower.startsWith("2001:db8") || lower.startsWith("64:ff9b") || lower.startsWith("100:")) return false;
    return true;
  }
  return false;
}

export function validateTargetUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("The address is not a valid URL."); }
  if (url.protocol !== "https:") throw new Error("Webhook addresses must use https.");
  if (url.username || url.password) throw new Error("Webhook addresses cannot contain credentials.");
  if (url.port && url.port !== "443") throw new Error("Webhook addresses must use the standard https port.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".") && isIP(host.replace(/^\[|\]$/g, "")) === 0)
    throw new Error("Webhook addresses must be public internet names.");
  if (isIP(host.replace(/^\[|\]$/g, "")) !== 0 && !isPublicAddress(host.replace(/^\[|\]$/g, ""))) throw new Error("Webhook addresses must not point at private networks.");
  return url;
}

type Lookup = (hostname: string) => Promise<{ address: string; family: number }[]>;
const defaultLookup: Lookup = async hostname => dns.promises.lookup(hostname, { all: true, verbatim: true });

// A lookup function for the TLS socket that refuses any answer containing a non-public address.
export function guardedLookup(resolve: Lookup = defaultLookup): LookupFunction {
  return ((hostname: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) => {
    resolve(hostname).then(addresses => {
      if (addresses.length === 0 || addresses.some(item => !isPublicAddress(item.address))) return callback(Object.assign(new Error("blocked address"), { code: "EBLOCKED" }));
      if (options?.all) return callback(null, addresses);
      return callback(null, addresses[0]!.address, addresses[0]!.family);
    }, error => callback(error));
  }) as unknown as LookupFunction;
}

export type Transport = (request: { url: URL; headers: Record<string, string>; body: string; timeoutMs: number }) => Promise<{ status: number }>;
export const httpsTransport: Transport = ({ url, headers, body, timeoutMs }) => new Promise((resolve, reject) => {
  const request = https.request({ protocol: "https:", hostname: url.hostname, port: 443, path: `${url.pathname}${url.search}`, method: "POST", headers: { ...headers, "Content-Length": Buffer.byteLength(body) }, lookup: guardedLookup(), timeout: timeoutMs }, response => {
    response.resume(); response.on("end", () => resolve({ status: response.statusCode ?? 0 }));
  });
  request.on("timeout", () => request.destroy(new Error("timeout")));
  request.on("error", reject);
  request.end(body);
});

export type AttemptResult = { attempt: number; outcome: "delivered" | "failed"; statusCode: number | null };
const retryable = (status: number | null) => status === null || status === 408 || status === 429 || status >= 500;

export async function deliver(input: { url: string; secret: string; event: WebhookEvent; now?: () => Date; transport?: Transport; sleep?: (ms: number) => Promise<void>; delays?: readonly number[]; timeoutMs?: number; onAttempt?: (result: AttemptResult) => Promise<void> | void }) {
  const { url, secret, event, transport = httpsTransport, sleep = ms => new Promise<void>(resolve => setTimeout(resolve, ms)), delays = RETRY_DELAYS_MS, timeoutMs = 5000, now = () => new Date() } = input;
  const target = validateTargetUrl(url);
  const body = JSON.stringify(event);
  const results: AttemptResult[] = [];
  for (const [index, delay] of delays.entries()) {
    if (delay > 0) await sleep(delay);
    const timestamp = Math.floor(now().getTime() / 1000);
    let status: number | null;
    try { status = (await transport({ url: target, body, timeoutMs, headers: { "Content-Type": "application/json", "User-Agent": "ORYQEN-Webhooks/1", "Oryqen-Event-Id": event.id, "Oryqen-Event-Type": event.type, "Oryqen-Signature": signPayload(secret, body, timestamp) } })).status; }
    catch { status = null; }
    const result: AttemptResult = { attempt: index + 1, outcome: status !== null && status >= 200 && status < 300 ? "delivered" : "failed", statusCode: status };
    results.push(result);
    await input.onAttempt?.(result);
    if (result.outcome === "delivered" || !retryable(status)) break;
  }
  return results;
}
