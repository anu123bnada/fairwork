import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { organizationDecisionSchema, organizationPageRequest } from "@/features/authority/organization-schema";
import { organizationService } from "@/server/organizations";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return apiResponse(async () => {
 const query = new URL(request.url).searchParams;
 const parsed = organizationPageRequest.safeParse(Object.fromEntries(query));
 if (!parsed.success || query.size > 1) throw new AppError("VALIDATION_FAILED", 422);
 return organizationService("list_organization_queue", parsed.data);
}, "organization-decision.v1"); }
export async function POST(request: Request) { return apiResponse(async () => {
 assertSameOrigin(request);
 return organizationService("decide_organization_request", await readJson(request, organizationDecisionSchema));
}, "organization-decision.v1"); }
