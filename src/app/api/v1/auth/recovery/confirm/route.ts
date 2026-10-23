import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { recoveryTokenSchema } from "@/features/identity/recovery-schema";
import { confirmRecovery } from "@/server/recovery";
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { tokenHash } = await readJson(request, recoveryTokenSchema);
    return confirmRecovery(tokenHash);
  }, "auth-recovery.v1");
}
