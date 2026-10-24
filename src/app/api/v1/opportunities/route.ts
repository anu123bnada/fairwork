import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { opportunityQuery, opportunityCommand } from "@/features/opportunities/schema";
import { opportunities } from "@/server/opportunities";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return apiResponse(async () => {
  const query = new URL(request.url).searchParams;
  if (new Set(query.keys()).size !== query.size) throw new AppError("VALIDATION_FAILED", 422);
  const parsed = opportunityQuery.safeParse(Object.fromEntries(query));
  if (!parsed.success) throw new AppError("VALIDATION_FAILED", 422);
  return opportunities("opportunity_read", parsed.data);
}, "opportunities.v1"); }
export async function POST(request: Request) { return apiResponse(async () => {
  assertSameOrigin(request);
  return opportunities("opportunity_command", await readJson(request, opportunityCommand));
}, "opportunities.v1"); }
