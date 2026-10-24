import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { guidanceRead, guidanceSend, guidancePage } from "@/features/guidance/schema";
import { createServerSupabase } from "@/server/supabase";
import { AppError, mapDatabaseError } from "@/lib/errors";
import type { Json } from "@/types/database";
export const dynamic = "force-dynamic";
async function command(request: Json) {
  const client = await createServerSupabase(true);
  const { data, error } = await client.auth.getUser();
  if (error && (error.status ?? 0) >= 500) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  const result = await client.rpc("guidance", { request });
  if (result.error) throw mapDatabaseError(result.error);
  const parsed = guidancePage.safeParse(result.data);
  if (!parsed.success) throw new AppError("SERVICE_UNAVAILABLE", 503);
  return parsed.data;
}
export async function GET(request: Request) { return apiResponse(async () => {
  const query = new URL(request.url).searchParams;
  if (query.size > 1 || (query.size === 1 && !query.has("threadId"))) throw new AppError("VALIDATION_FAILED", 422);
  const parsed = guidanceRead.safeParse({ operation: "read", threadId: query.get("threadId") });
  if (!parsed.success) throw new AppError("VALIDATION_FAILED", 422);
  return command(parsed.data);
}, "guidance.v1"); }
export async function POST(request: Request) { return apiResponse(async () => { assertSameOrigin(request); return command(await readJson(request, guidanceSend)); }, "guidance.v1"); }
