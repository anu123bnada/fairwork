import { apiResponse, assertSameOrigin, idempotencyKey, readJson } from "@/server/http";
import { companyReadSchema, companySearchSchema, companySaveSchema } from "@/features/authority/company-schema";
import { companyService } from "@/server/companies";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return apiResponse(async () => {
 const query = new URL(request.url).searchParams;
 if (query.size > 1) throw new AppError("VALIDATION_FAILED", 422);
 if (query.has("companyId")) {
  const parsed = companyReadSchema.safeParse(Object.fromEntries(query));
  if (!parsed.success) throw new AppError("VALIDATION_FAILED", 422);
  return companyService("company_profile", { operation: "read", ...parsed.data });
 }
 const parsed = companySearchSchema.safeParse(Object.fromEntries(query));
 if (!parsed.success) throw new AppError("VALIDATION_FAILED", 422);
 return companyService("find_companies", parsed.data);
}, "company-claims.v1"); }
export async function POST(request: Request) { return apiResponse(async () => {
 assertSameOrigin(request);
 return companyService("company_profile", { operation: "save", ...await readJson(request, companySaveSchema), idempotencyKey: idempotencyKey(request) });
}, "company-claims.v1"); }
