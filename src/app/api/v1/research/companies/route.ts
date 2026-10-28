import { apiResponse } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { researchQuery, researchResponse } from "@/features/research/schema";
import { buildFindings, nameMatch, noMatchLimitation, sourceFreshness, standardLimitations } from "@/features/research/analysis";
import { GLEIF_SOURCE, searchGleif } from "@/server/research/gleif";
import { addResearchHistory, rpcFor } from "@/server/research/history";
export const dynamic = "force-dynamic";

// Per-process, per-user limiter (a hosted deployment with many instances multiplies this limit).
// It protects the public registry from being used as an open proxy; it is not a security boundary.
const buckets = new Map<string, number[]>();
const LIMIT = 12, WINDOW_MS = 60_000;
function allow(user: string, now: number) {
  const recent = (buckets.get(user) ?? []).filter(at => now - at < WINDOW_MS);
  if (recent.length >= LIMIT) { buckets.set(user, recent); return false; }
  recent.push(now); buckets.set(user, recent);
  if (buckets.size > 5000) buckets.delete(buckets.keys().next().value as string);
  return true;
}

export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const input = researchQuery.safeParse(Object.fromEntries(query));
    if (!input.success || [...query.keys()].some(key => !["name", "country"].includes(key)) || query.getAll("name").length !== 1) throw new AppError("VALIDATION_FAILED", 422);
    const client = await createServerSupabase(true);
    const { data: identity, error } = await client.auth.getUser();
    if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (error || !identity.user || identity.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    if (!allow(identity.user.id, Date.now())) throw new AppError("RATE_LIMITED", 429);
    const country = input.data.country ?? null, now = new Date();
    const { records, total } = await searchGleif({ name: input.data.name, country });
    const results = records.map(record => ({ record, nameMatch: nameMatch(input.data.name, record), freshness: sourceFreshness(record, now), findings: buildFindings(record, { name: input.data.name, country }, now) }));
    const order = { exact: 0, close: 1, partial: 2, weak: 3 } as const;
    results.sort((a, b) => order[a.nameMatch] - order[b.nameMatch]);
    // Keep a private record of this search for the person. It never blocks or fails the search itself.
    const top = results[0];
    await addResearchHistory(rpcFor(client as never), { queryName: input.data.name, queryCountry: country, totalMatches: total, topLei: top?.record.identifier.value ?? null, topName: top?.record.legalName ?? null, topMatch: top?.nameMatch ?? "none", source: GLEIF_SOURCE.name, retrievedAt: top?.record.retrievedAt ?? now.toISOString() }).catch(() => undefined);
    return researchResponse.parse({
      query: { name: input.data.name, country }, results: results.slice(0, 10), totalMatches: total, source: GLEIF_SOURCE,
      limitations: results.length ? standardLimitations : [noMatchLimitation, ...standardLimitations],
    });
  }, "company-research.v1");
}
