import { apiResponse, assertSameOrigin, readJson } from "@/server/http";
import { emptyRequestSchema } from "@/features/identity/schema";
import { createServerSupabase } from "@/server/supabase";
import {recordRuntimeEvent} from "@/server/telemetry";
import { AppError } from "@/lib/errors";
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    await readJson(request, emptyRequestSchema);
    const supabase = await createServerSupabase(true);
    // A failed identity lookup must not prevent clearing the current session.
    let subjectId:string|undefined;
    try{const identity=await supabase.auth.getUser();if(!identity.error&&identity.data.user&&!identity.data.user.is_anonymous)subjectId=identity.data.user.id;}catch{/* Do not attribute an unverified sign-out. */}
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw new AppError("SERVICE_UNAVAILABLE", 503);
    if(subjectId) await recordRuntimeEvent({id:crypto.randomUUID(),kind:"logout_success",operation:"auth.sign-out",subjectId});
    return { signedOut: true };
  });
}
