import { createHash, randomBytes, randomUUID } from "node:crypto";

// Developer API keys (module 21, docs/ORYQEN_DEVELOPER_API.md). Format: oryq_live_<key id>.<secret>. Only the key id and
// the SHA-256 of the secret ever reach the database; the full key is shown to its owner once, at creation.
export { developerScopes, type DeveloperScope } from "./schema";
const PREFIX = "oryq_live_";
const KEY_PATTERN = /^oryq_live_([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/;

export function generateDeveloperKey(): { keyId: string; key: string; secretHash: string } {
  const keyId = randomUUID(), secret = randomBytes(32).toString("base64url");
  return { keyId, key: `${PREFIX}${keyId}.${secret}`, secretHash: createHash("sha256").update(secret).digest("hex") };
}

// Accepts `Authorization: Bearer <key>` only. Anything else is "no key", never a partial match.
export function parseDeveloperKey(authorization: string | null): { keyId: string; secretHash: string } | null {
  const match = /^Bearer (\S+)$/.exec(authorization ?? "");
  const parts = match ? KEY_PATTERN.exec(match[1]!) : null;
  return parts ? { keyId: parts[1]!, secretHash: createHash("sha256").update(parts[2]!).digest("hex") } : null;
}

export { developerKeyCheck, developerKeyCreated, developerKeyLabel, developerKeyList, developerKeyRow, verifyRequest } from "./schema";
