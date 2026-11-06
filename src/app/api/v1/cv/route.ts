import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { cvSaveInput } from "@/features/cv/schema";
import { listCvs, readCv, saveCv } from "@/server/cv/documents";
import { rpcFor } from "@/server/research/history";
import { z } from "zod";
export const dynamic = "force-dynamic";

async function signedIn() {
  const client = await createServerSupabase(true);
  const { data, error } = await client.auth.getUser();
  if (isAuthServiceUnavailable(error)) throw new AppError("SERVICE_UNAVAILABLE", 503);
  if (error || !data.user || data.user.is_anonymous) throw new AppError("AUTH_REQUIRED", 401);
  return rpcFor(client as never);
}

// Without parameters: the caller's own CV list. With ?id=<uuid>: one of their documents. Nothing else is accepted.
export async function GET(request: Request) {
  return apiResponse(async () => {
    const params = new URL(request.url).searchParams;
    const keys = [...params.keys()];
    if (keys.length === 0) return listCvs(await signedIn());
    const id = z.uuid().safeParse(params.get("id"));
    if (keys.length !== 1 || keys[0] !== "id" || !id.success) throw new AppError("VALIDATION_FAILED", 422);
    return readCv(await signedIn(), id.data);
  }, "cv.v1");
}

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    return saveCv(await signedIn(), await readJson(request, cvSaveInput));
  }, "cv.v1");
}
