import { z } from "zod";
import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { readExpiry, setExpiry } from "@/server/agreement-expiry";
import { expirySetInput } from "@/features/offer/expiry";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return apiResponse(async () => {
    const query = new URL(request.url).searchParams;
    const id = z.uuid().safeParse(query.get("agreementId"));
    if (!id.success || [...query.keys()].length !== 1) throw new AppError("VALIDATION_FAILED", 422);
    return readExpiry(id.data);
  }, "agreement-workflow.v1");
}
// Set or renew the expiry of the caller's own current proposal. Only the worker who proposed it can; the database checks.
export async function POST(request: Request) {
  return apiResponse(async () => { assertSameOrigin(request); return setExpiry(await readJson(request, expirySetInput)); }, "agreement-workflow.v1");
}
