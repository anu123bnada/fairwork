import "server-only";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { registryRecord, type RegistryRecord } from "@/features/research/schema";

// Provider: GLEIF Global LEI Index (https://www.gleif.org/), a public registry of legal entities.
// It is called with no credentials, from a fixed host, with redirects refused, a hard timeout and a
// response-size cap. Nothing from the browser is placed in a URL without encoding.
const HOST = "https://api.gleif.org/api/v1";
export const GLEIF_SOURCE = { provider: "gleif" as const, name: "GLEIF Global LEI Index", url: "https://www.gleif.org/en/lei-data/gleif-api", kind: "third_party_registry" as const };
const MAX_BYTES = 1_000_000;

const address = z.object({ addressLines: z.array(z.string().nullable()).optional(), city: z.string().nullable().optional(), region: z.string().nullable().optional(), country: z.string().nullable().optional(), postalCode: z.string().nullable().optional() }).passthrough();
const leiData = z.object({
  id: z.string().regex(/^[A-Z0-9]{20}$/),
  attributes: z.object({
    entity: z.object({
      legalName: z.object({ name: z.string() }),
      otherNames: z.array(z.object({ name: z.string() })).optional().default([]),
      legalAddress: address.nullable().optional(),
      registeredAt: z.object({ id: z.string().nullable().optional() }).nullable().optional(),
      registeredAs: z.string().nullable().optional(),
      jurisdiction: z.string().nullable().optional(),
      legalForm: z.object({ id: z.string().nullable().optional(), other: z.string().nullable().optional() }).nullable().optional(),
      status: z.string(),
    }),
    registration: z.object({
      status: z.string(), lastUpdateDate: z.string().nullable().optional(), nextRenewalDate: z.string().nullable().optional(),
      corroborationLevel: z.string().nullable().optional(),
    }),
  }),
}).passthrough();
const listResponse = z.object({ data: z.array(leiData).max(100), meta: z.object({ pagination: z.object({ total: z.number().int().nonnegative() }).optional() }).optional() });
const oneResponse = z.object({ data: leiData });

type Fetch = typeof fetch;
const cache = new Map<string, { at: number; value: unknown }>();
const TTL_MS = 15 * 60_000;
function cached<T>(key: string, now: number): T | null {
  const hit = cache.get(key);
  if (hit && now - hit.at < TTL_MS) return hit.value as T;
  cache.delete(key); return null;
}
function remember(key: string, value: unknown, now: number) {
  if (cache.size >= 200) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: now, value });
}
export function clearResearchCache() { cache.clear(); }

async function getJson(path: string, params: URLSearchParams, fetchImpl: Fetch): Promise<unknown> {
  const url = `${HOST}${path}${[...params].length ? `?${params}` : ""}`;
  let response: Response;
  try {
    response = await fetchImpl(url, { redirect: "error", cache: "no-store", headers: { Accept: "application/vnd.api+json", "User-Agent": "ORYQEN-company-research/1" }, signal: AbortSignal.timeout(10_000) });
  } catch { throw new AppError("SERVICE_UNAVAILABLE", 503); }
  if (response.status === 429) throw new AppError("RATE_LIMITED", 429);
  if (response.status === 404) return null;
  if (!response.ok) throw new AppError("SERVICE_UNAVAILABLE", 503);
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new AppError("SERVICE_UNAVAILABLE", 503);
  try { return JSON.parse(text); } catch { throw new AppError("SERVICE_UNAVAILABLE", 503); }
}

function formatAddress(a: z.infer<typeof address> | null | undefined): string | null {
  if (!a) return null;
  const parts = [...(a.addressLines ?? []), a.city, a.postalCode, a.country].filter((part): part is string => typeof part === "string" && part.trim().length > 0);
  return parts.length ? parts.join(", ").slice(0, 400) : null;
}
export function toRegistryRecord(data: z.infer<typeof leiData>, retrievedAt: string): RegistryRecord {
  const entity = data.attributes.entity, registration = data.attributes.registration;
  const country = entity.legalAddress?.country ?? null;
  return registryRecord.parse({
    provider: "gleif", providerName: "GLEIF Global LEI Index",
    identifier: { scheme: "LEI", value: data.id },
    legalName: entity.legalName.name, otherNames: entity.otherNames.map(n => n.name).slice(0, 10),
    country: country && /^[A-Z]{2}$/.test(country) ? country : null, jurisdiction: entity.jurisdiction ?? null,
    legalForm: entity.legalForm?.other ?? entity.legalForm?.id ?? null,
    entityStatus: entity.status, registrationStatus: registration.status, corroboration: registration.corroborationLevel ?? null,
    registrationAuthority: { id: entity.registeredAt?.id ?? null, entityId: entity.registeredAs ?? null },
    legalAddress: formatAddress(entity.legalAddress),
    sourceLastUpdated: registration.lastUpdateDate ?? null, nextRenewal: registration.nextRenewalDate ?? null,
    sourceUrl: `${HOST}/lei-records/${data.id}`, retrievedAt,
  });
}

export async function searchGleif(input: { name: string; country: string | null }, deps: { fetchImpl?: Fetch; now?: () => number } = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch, nowMs = (deps.now ?? Date.now)();
  const name = input.name.replace(/\p{Cc}/gu, " ").replace(/\s+/g, " ").trim();
  const key = `search:${name.toLowerCase()}:${input.country ?? ""}`;
  const hit = cached<{ records: RegistryRecord[]; total: number }>(key, nowMs);
  if (hit) return hit;
  const params = new URLSearchParams({ "filter[fulltext]": name, "page[size]": "10" });
  if (input.country) params.set("filter[entity.legalAddress.country]", input.country);
  const raw = await getJson("/lei-records", params, fetchImpl);
  const parsed = listResponse.safeParse(raw);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  const retrievedAt = new Date(nowMs).toISOString();
  const value = { records: parsed.data.data.map(item => toRegistryRecord(item, retrievedAt)), total: parsed.data.meta?.pagination?.total ?? parsed.data.data.length };
  remember(key, value, nowMs);
  return value;
}

export async function getGleifRecord(lei: string, deps: { fetchImpl?: Fetch; now?: () => number } = {}): Promise<RegistryRecord | null> {
  if (!/^[A-Z0-9]{20}$/.test(lei)) throw new AppError("VALIDATION_FAILED", 422);
  const fetchImpl = deps.fetchImpl ?? fetch, nowMs = (deps.now ?? Date.now)();
  const raw = await getJson(`/lei-records/${lei}`, new URLSearchParams(), fetchImpl);
  if (raw === null) return null;
  const parsed = oneResponse.safeParse(raw);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return toRegistryRecord(parsed.data.data, new Date(nowMs).toISOString());
}
