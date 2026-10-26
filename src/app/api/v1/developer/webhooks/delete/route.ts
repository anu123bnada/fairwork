import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { signedInClient } from "@/server/developer/session";
import { mapDatabaseError } from "@/lib/errors";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { webhookId } = await readJson(request, z.strictObject({ webhookId: z.uuid() }));
    const { rpc } = await signedInClient();
    const { data, error } = await rpc("webhook_delete", { webhookId });
    if (error) throw mapDatabaseError(error);
    return data;
  }, "developer-webhooks.v1");
}
