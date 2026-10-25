import { apiResponse, assertSameOrigin, idempotencyKey, readJson } from "@/server/http";
import { createProfileSchema, updateProfileSchema } from "@/features/identity/schema";
import { identityCommand } from "@/server/identity";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return apiResponse(async (requestId) => {
    if (new URL(request.url).search) throw new AppError("VALIDATION_FAILED", 422);
    return identityCommand("get_me", {}, requestId);
  });
}
export async function POST(request: Request) {
  return apiResponse(async (requestId) => {
    assertSameOrigin(request);
    const input = await readJson(request, createProfileSchema);
    return identityCommand("create_profile", { ...input, idempotencyKey: idempotencyKey(request) }, requestId);
  });
}
export async function PATCH(request: Request) {
  return apiResponse(async (requestId) => {
    assertSameOrigin(request);
    const input = await readJson(request, updateProfileSchema);
    return identityCommand("update_profile", { ...input, idempotencyKey: idempotencyKey(request) }, requestId);
  });
}
