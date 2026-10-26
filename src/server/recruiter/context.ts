import "server-only";
import { signedInClient } from "@/server/developer/session";
import { AppError } from "@/lib/errors";

// A signed-in caller with an RPC runner under their own session. Checks that reach out to the internet are limited per person and per
// server process, which keeps the verification feature from being used as a way to make our server fetch things.
const buckets = new Map<string, number[]>();
export function limitFetches(user: string, now = Date.now(), limit = 20, windowMs = 60_000) {
  const recent = (buckets.get(user) ?? []).filter(at => now - at < windowMs);
  if (recent.length >= limit) { buckets.set(user, recent); throw new AppError("RATE_LIMITED", 429); }
  recent.push(now); buckets.set(user, recent);
  if (buckets.size > 5000) buckets.delete(buckets.keys().next().value as string);
}
export async function recruiterContext(options: { fetches?: boolean } = {}) {
  const context = await signedInClient();
  if (options.fetches) limitFetches(context.userId);
  return context;
}
