import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { passwordUpdateSchema } from "@/features/identity/recovery-schema";
import { updatePassword } from "@/server/recovery";
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { password } = await readJson(request, passwordUpdateSchema);
    return updatePassword(password);
  }, "auth-recovery.v1");
}
