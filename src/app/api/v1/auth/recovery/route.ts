import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { recoveryRequestSchema } from "@/features/identity/recovery-schema";
import { requestRecovery } from "@/server/recovery";
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { email, continuation } = await readJson(request, recoveryRequestSchema);
    return requestRecovery(email, continuation);
  }, "auth-recovery.v1");
}
