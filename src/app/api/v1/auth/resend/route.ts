import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { verificationResendSchema } from "@/features/identity/registration-schema";
import { requireRegistration, resendVerification } from "@/server/registration";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    requireRegistration();
    const input = await readJson(request, verificationResendSchema);
    return resendVerification(input.email, input.continuation);
  }, "auth-verification-resend.v1");
}
