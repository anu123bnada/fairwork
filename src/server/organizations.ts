import "server-only";
import { createServerSupabase } from "./supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { organizationListSchema, organizationQueueSchema, organizationReceiptSchema, organizationDecisionReceipt } from "@/features/authority/organization-schema";
import type { Json } from "@/types/database";
export async function organizationService(command: "request_organization" | "list_organization_requests" | "decide_organization_request" | "list_organization_queue", request: Json) {
 const client = await createServerSupabase(true);
 const { data, error } = await client.auth.getUser();
 if (error && (error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
 if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
 const result = await client.rpc(command, { request });
 if (result.error) throw mapDatabaseError(result.error);
 const schema = command === "request_organization" ? organizationReceiptSchema : command === "decide_organization_request" ? organizationDecisionReceipt : command === "list_organization_queue" ? organizationQueueSchema : organizationListSchema;
 const parsed = schema.safeParse(result.data);
 if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
 return parsed.data;
}
