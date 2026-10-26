import { getServerEnvironment } from "@/server/env";
import { credentialConfig } from "@/server/credentials/config";
export const dynamic = "force-dynamic";

// Public keys only. Anyone may fetch them to verify a credential offline; the private key never
// appears here. Without a valid signing configuration this answers 404 so a verifier fails closed.
export async function GET() {
  const origin = getServerEnvironment().origin;
  const config = credentialConfig(origin);
  if (!config) return Response.json({ error: "credential signing is not configured" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return Response.json({ issuer: config.issuer, keys: Object.entries(config.publicKeys).map(([kid, jwk]) => ({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, kid, use: "sig", alg: "EdDSA" })) },
    { headers: { "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
