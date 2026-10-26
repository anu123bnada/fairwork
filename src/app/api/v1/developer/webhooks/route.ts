import { randomBytes, randomUUID } from "node:crypto";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { signedInClient } from "@/server/developer/session";
import { validateTargetUrl } from "@/server/developer/webhook";
import { webhookCreateRequest, webhookCreated, webhookList } from "@/features/developer/schema";
import { AppError, mapDatabaseError } from "@/lib/errors";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiResponse(async () => {
    if ([...new URL(request.url).searchParams.keys()].length) throw new AppError("VALIDATION_FAILED", 422);
    const { rpc } = await signedInClient();
    const { data, error } = await rpc("webhook_list", {});
    if (error) throw mapDatabaseError(error);
    const parsed = webhookList.safeParse(data);
    if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return parsed.data; // never includes a secret
  }, "developer-webhooks.v1");
}

// Registers an https endpoint of the caller's own. The signing secret is created here, shown once, and stored for signing only.
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { url } = await readJson(request, webhookCreateRequest);
    let target: URL;
    try { target = validateTargetUrl(url); } catch { throw new AppError("VALIDATION_FAILED", 422); }
    const { rpc } = await signedInClient();
    const secret = randomBytes(32).toString("base64url");
    const { data, error } = await rpc("webhook_create", { webhookId: randomUUID(), url: target.toString(), secret });
    if (error) throw mapDatabaseError(error);
    const parsed = webhookCreated.safeParse(data);
    if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
    return { ...parsed.data, secret, note: "Copy this signing secret now. It cannot be shown again." };
  }, "developer-webhooks.v1");
}
