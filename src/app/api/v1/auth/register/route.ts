import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { registrationSchema } from "@/features/identity/registration-schema";
import { registerAccount, requireRegistration } from "@/server/registration";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    requireRegistration();
    const input = await readJson(request, registrationSchema);
    return registerAccount(input.email, input.password, input.continuation, input.displayName);
  }, "auth-registration.v1");
}
