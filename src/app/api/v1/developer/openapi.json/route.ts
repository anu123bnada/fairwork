import { getServerEnvironment } from "@/server/env";
import { developerOpenApi } from "@/features/developer/openapi";
export const dynamic = "force-dynamic";

// Public, read-only description of the Developer API. It contains no key, no account data and nothing that varies per caller.
export async function GET() {
  return Response.json(developerOpenApi(getServerEnvironment().origin), { headers: { "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
