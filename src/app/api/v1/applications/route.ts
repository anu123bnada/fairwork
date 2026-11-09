import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { createServerSupabase } from "@/server/supabase";
import { AppError } from "@/lib/errors";
import { isAuthServiceUnavailable } from "@/lib/auth-errors";
import { applicationCommand } from "@/features/applications/schema";
import { listingDashboard, listingInbox, myApplications, runApplicationCommand } from "@/server/applications/applications";
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

// ?view=mine lists the caller's own applications; ?view=dashboard lists the caller's own listings with applicant counts; ?listingId=<uuid> is the inbox of one listing the caller authored.
// The database decides who may see what (only the listing's author with active company authority sees applicants); nothing else is accepted.
export async function GET(request: Request) {
  return apiResponse(async () => {
    const params = new URL(request.url).searchParams;
    const keys = [...params.keys()];
    if (keys.length !== 1) throw new AppError("VALIDATION_FAILED", 422);
    if (keys[0] === "view") {
      const view = params.get("view");
      if (view === "mine") return myApplications(await signedIn());
      if (view === "dashboard") return listingDashboard(await signedIn());
      throw new AppError("VALIDATION_FAILED", 422);
    }
    const listingId = z.uuid().safeParse(params.get("listingId"));
    if (keys[0] !== "listingId" || !listingId.success) throw new AppError("VALIDATION_FAILED", 422);
    return listingInbox(await signedIn(), listingId.data);
  }, "applications.v1");
}

export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    return runApplicationCommand(await signedIn(), await readJson(request, applicationCommand));
  }, "applications.v1");
}
