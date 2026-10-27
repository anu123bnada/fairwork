import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { recoveryTokenSchema } from "@/features/identity/recovery-schema";
import { confirmRecovery } from "@/server/recovery";
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    return confirmRecovery(await readJson(request, recoveryTokenSchema));
  }, "auth-recovery.v1");
}
