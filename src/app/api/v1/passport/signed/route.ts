import { apiResponse, assertSameOrigin } from "@/server/http";
import { workIntegrityService } from "@/server/work-integrity";
import { getServerEnvironment } from "@/server/env";
import { credentialConfig } from "@/server/credentials/config";
import { collectPrivatePassportExport } from "@/features/work/passport-export";
import { passportPayload, signPassport } from "@/features/work/passport-signing";
import { AppError } from "@/lib/errors";
export const dynamic = "force-dynamic";

// A signed copy of the caller's own eligible Passport records. Every page is re-authorized as it is read (the same collector as the private download),
// and the signature uses the credential issuer key. Without a configured key this answers 503: there is never a fallback key.
export async function POST(request: Request) {
  return apiResponse(async () => {
    assertSameOrigin(request);
    const config = credentialConfig(getServerEnvironment().origin);
    if (!config) throw new AppError("SERVICE_UNAVAILABLE", 503);
    const now = new Date();
    let collected;
    try { collected = await collectPrivatePassportExport(cursor => workIntegrityService({ cursor }), now.toISOString()); }
    catch (error) { if (error instanceof AppError) throw error; throw new AppError("SERVICE_UNAVAILABLE", 503); }
    const payload = passportPayload({ issuer: config.issuer, issuedAt: now, records: collected.records });
    return { jws: await signPassport(payload, { privateJwk: config.privateJwk, keyId: config.keyId }), payload, keyId: config.keyId, issuer: config.issuer };
  }, "private-work-passport.v1");
}
