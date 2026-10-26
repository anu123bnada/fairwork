import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { signedInClient } from "@/server/developer/session";
import { pingEndpoint, pingRequest } from "@/server/developer/webhook-service";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

// Sends one signed test event to one of the caller's own endpoints and reports what it answered.
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { webhookId } = await readJson(request, pingRequest);
    const { rpc } = await signedInClient();
    const result = await pingEndpoint(rpc, webhookId);
    if (!result) throw new AppError("NOT_FOUND", 404);
    return { eventId: result.eventId, outcome: result.attempt.outcome, statusCode: result.attempt.statusCode };
  }, "developer-webhooks.v1");
}
