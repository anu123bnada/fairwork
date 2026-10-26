import "server-only";
import dns from "node:dns";
import https from "node:https";
import { isIP } from "node:net";
import type { LookupFunction } from "node:net";

// Shared rules for connecting to addresses chosen by someone other than the operator (webhook targets, pages a person asks us to look at).
// Connections are made over https only, and the address check runs inside the socket's own DNS lookup, so a name cannot change its answer
// between a check and a connection and reach a private network.
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


export type TextResponse = { status: number; contentType: string | null; location: string | null; text: string; truncated: boolean };
export type TextFetcher = (url: URL, options: { timeoutMs: number; maxBytes: number; userAgent: string; accept?: string }) => Promise<TextResponse>;

// One GET, no redirects followed, body capped. Used only for pages and files a person or an employer pointed us at.
export const fetchPublicText: TextFetcher = (url, { timeoutMs, maxBytes, userAgent, accept }) => new Promise((resolve, reject) => {
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return reject(new Error("only plain https addresses can be read"));
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) !== 0 && !isPublicAddress(host)) return reject(new Error("blocked address"));
  const request = https.request({ protocol: "https:", hostname: url.hostname, port: 443, path: `${url.pathname}${url.search}`, method: "GET", headers: { "User-Agent": userAgent, Accept: accept ?? "text/html,text/plain;q=0.9,*/*;q=0.1", "Accept-Encoding": "identity" }, lookup: guardedLookup(), timeout: timeoutMs }, response => {
    const chunks: Buffer[] = []; let length = 0, truncated = false;
    response.on("data", (chunk: Buffer) => {
      if (truncated) return;
      length += chunk.length;
      if (length > maxBytes) { truncated = true; chunks.push(chunk.subarray(0, Math.max(0, chunk.length - (length - maxBytes)))); request.destroy(); response.destroy(); return; }
      chunks.push(chunk);
    });
    const finish = () => resolve({ status: response.statusCode ?? 0, contentType: String(response.headers["content-type"] ?? "").split(";")[0]?.trim() || null, location: typeof response.headers.location === "string" ? response.headers.location : null, text: Buffer.concat(chunks).toString("utf8"), truncated });
    response.on("end", finish); response.on("close", finish);
  });
  request.on("timeout", () => request.destroy(new Error("timeout")));
  request.on("error", reject);
  request.end();
});

export type TxtResolver = (name: string) => Promise<string[][]>;
export const resolveTxtRecords: TxtResolver = name => dns.promises.resolveTxt(name);
