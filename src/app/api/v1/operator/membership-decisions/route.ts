import { apiResponse, assertSameOrigin, idempotencyKey, readJson } from "@/server/http";
import { membershipInput } from "@/features/authority/schema";
import { authorityCommand } from "@/server/authority";
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const input = await readJson(request, membershipInput);
    return authorityCommand("decide_membership", { ...input, idempotencyKey: idempotencyKey(request) });
  }, "authority.v1");
}
