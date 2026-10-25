import { apiResponse } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { workService } from "@/server/work";
import { listOffers, readAgreement } from "@/server/offer";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { employmentPage, type EmploymentPage } from "@/features/work/employment-schema";
import type { WorkList, WorkRecord } from "@/features/work/schema";
import type { AgreementRead } from "@/features/offer/read-schema";
import { buildTrustChain } from "@/features/trust/build";
import { trustChainResponse } from "@/features/trust/schema";
export const dynamic = "force-dynamic";

// Read-only. Every record is read through the same authorized services the rest of the product uses,
// so a caller can only ever see their own claims. Nothing is stored and no new privilege is used.
const MAX_WORK = 30, MAX_OFFERS = 20, MAX_EMPLOYMENT_PAGES = 5, BATCH = 5;

async function inBatches<T, R>(items: T[], run: (item: T) => Promise<R>): Promise<{ values: R[]; failed: number }> {
  const values: R[] = []; let failed = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const settled = await Promise.allSettled(items.slice(i, i + BATCH).map(run));
    for (const result of settled) { if (result.status === "fulfilled") values.push(result.value); else failed++; }
  }
  return { values, failed };
}

export async function GET(request: Request) {
  return apiResponse(async () => {
    if ([...new URL(request.url).searchParams.keys()].length) throw new AppError("VALIDATION_FAILED", 422);
    const client = await createServerSupabase(true);
    const { data: identity, error: authError } = await client.auth.getUser();
    if (isAuthServiceUnavailable(authError)) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (authError || !identity.user || identity.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);

    let truncated = false;
    const employment: EmploymentPage["items"] = [];
    let cursor: string | null = null;
    for (let page = 0; page < MAX_EMPLOYMENT_PAGES; page++) {
      const { data, error } = await client.rpc("employment_history", { request: { operation: "list", cursor } });
      if (error) throw mapDatabaseError(error);
      const parsed = employmentPage.safeParse(data);
      if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
      employment.push(...parsed.data.items); cursor = parsed.data.nextCursor;
      if (!cursor) break;
      if (page === MAX_EMPLOYMENT_PAGES - 1) truncated = true;
    }

    const workIds: string[] = []; let workCursor: string | null = null;
    while (workIds.length < MAX_WORK) {
      const page = await workService({ cursor: workCursor }) as WorkList;
      workIds.push(...page.items.map(item => item.workId)); workCursor = page.nextCursor;
      if (!workCursor) break;
    }
    if (workCursor || workIds.length > MAX_WORK) truncated = true;
    const work = await inBatches(workIds.slice(0, MAX_WORK), id => workService({ workId: id }) as Promise<WorkRecord>);
    // list_work also returns records the caller reviews as an employer representative. Those are other
    // people's claims; only records where the caller is the worker belong in this chain.
    work.values = work.values.filter(record => record.workerId === identity.user.id);

    const offerPage = await listOffers({ context: "WORKER", cursor: null, view: "all" });
    if (offerPage.nextCursor) truncated = true;
    const agreements = await inBatches(offerPage.items.slice(0, MAX_OFFERS), item => readAgreement({ offerId: item.offerId }) as Promise<AgreementRead>);

    if (work.failed || agreements.failed) truncated = true;
    const response = buildTrustChain({ employment, work: work.values, agreements: agreements.values, truncated }, new Date());
    const parsed = trustChainResponse.safeParse(response);
    if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return parsed.data;
  }, "trust-chain.v1");
}
