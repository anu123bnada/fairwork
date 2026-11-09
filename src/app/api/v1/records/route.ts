import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { recordKind, recordSaveInput } from "@/features/records/schema";
import { listRecords, readRecord, saveRecord } from "@/server/records/records";
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

// ?kind=application|project lists the caller's own records of that kind; ?id=<uuid> reads one of them. Nothing else is accepted.
export async function GET(request: Request) {
  return apiResponse(async () => {
    const params = new URL(request.url).searchParams;
    const keys = [...params.keys()];
    if (keys.length !== 1) throw new AppError("VALIDATION_FAILED", 422);
    if (keys[0] === "kind") { const kind = recordKind.safeParse(params.get("kind")); if (!kind.success) throw new AppError("VALIDATION_FAILED", 422); return listRecords(await signedIn(), kind.data); }
    const id = z.uuid().safeParse(params.get("id"));
    if (keys[0] !== "id" || !id.success) throw new AppError("VALIDATION_FAILED", 422);
    return readRecord(await signedIn(), id.data);
  }, "records.v1");
}

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    return saveRecord(await signedIn(), await readJson(request, recordSaveInput));
  }, "records.v1");
}
