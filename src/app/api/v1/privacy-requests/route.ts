import { apiResponse, assertSameOrigin, idempotencyKey, readJson } from "@/server/http";
import { privacyCommand, privacyQuery } from "@/features/identity/privacy-schema";
import { privacyService } from "@/server/privacy";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return apiResponse(async () => {
 const query = new URL(request.url).searchParams;
 const parsed = privacyQuery.safeParse(Object.fromEntries(query));
 if (!parsed.success || query.size > 1) throw new AppError("VALIDATION_FAILED", 422);
 return privacyService("privacy_requests", { operation: "requestId" in parsed.data ? "read" : "list", ...parsed.data }, !("requestId" in parsed.data));
}, "privacy-request.v1"); }
export async function POST(request: Request) { return apiResponse(async () => {
 assertSameOrigin(request);
 return privacyService("privacy_requests", { ...await readJson(request, privacyCommand), idempotencyKey: idempotencyKey(request) });
}, "privacy-request.v1"); }
