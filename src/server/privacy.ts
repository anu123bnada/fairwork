import "server-only";
import { createServerSupabase } from "./supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import { privacyList, privacyRequest } from "@/features/identity/privacy-schema";
import type { Json } from "@/types/database";
export async function privacyService(command: "privacy_requests" | "privacy_review", input: Json, list = false) {
 const client = await createServerSupabase(true);
 const { data, error } = await client.auth.getUser();
 if (error && (error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
 if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
 const result = await client.rpc(command, { request: input });
 if (result.error) throw mapDatabaseError(result.error);
 const parsed = (list ? privacyList : privacyRequest).safeParse(result.data);
 if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
 return parsed.data;
}
