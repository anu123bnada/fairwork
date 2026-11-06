import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { cvDeleteInput } from "@/features/cv/schema";
import { deleteCv } from "@/server/cv/documents";
import { rpcFor } from "@/server/research/history";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const { id } = await readJson(request, cvDeleteInput);
    const client = await createServerSupabase(true);
    const { data, error } = await client.auth.getUser();
    if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
    return deleteCv(rpcFor(client as never), id);
  }, "cv.v1");
}
