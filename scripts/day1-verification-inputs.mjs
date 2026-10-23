import { createServerClient } from "@supabase/ssr";

// Accept only the complete, named owner-exported catalog verdict set. This does
// not authenticate the export or replace migration-history/ACL evidence.
export const catalogChecks = Object.freeze([
  "identity migration recorded",
  "private Auth context migration recorded",
  "retired grant proposal remains unrecorded",
  "two restricted scalar Auth context helpers",
  "scalar helper owner can call existing Auth functions",
  "domain functions and RLS have no direct Auth helper calls",
  "exactly five private tables with FORCE RLS and separate owner",
  "runtime roles cannot login or bypass RLS",
  "client roles have no executor membership",
  "client roles have no private schema or table/column privileges",
  "only three approved api function signatures",
  "RPC grants are authenticated-only among public client roles",
  "private helpers have no public client execution",
  "api schema contains no tables or views",
  "eleven expected RLS policies present",
  "four invariant triggers enabled",
]);

export function validCatalogReport(value, projectRef, nowMs = Date.now()) {
  if (!value || typeof value !== "object" || typeof projectRef !== "string" || !projectRef
    || value.projectRef !== projectRef || typeof value.timestamp !== "string" || !Number.isSafeInteger(nowMs)) return false;
  const capturedAt = Date.parse(value.timestamp);
  if (!Number.isFinite(capturedAt) || nowMs - capturedAt > 60 * 60 * 1000 || capturedAt - nowMs > 5 * 60 * 1000) return false;
  const rows = value.rows;
  return Array.isArray(rows) && rows.length === catalogChecks.length
    && new Set(rows.map(row => row?.check_name)).size === catalogChecks.length
    && rows.every(row => row !== null && typeof row === "object"
      && catalogChecks.includes(row.check_name) && row.result === "PASS");
}

// Use provider-issued session expiry metadata; never rewrite cookies/JWT expiry
// or alter hosted settings to manufacture an expiry result.
export function expiryWaitPlan(expiresAt, nowMs = Date.now()) {
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0 || !Number.isSafeInteger(nowMs) || nowMs < 0
    || !Number.isSafeInteger(expiresAt * 1000 + 35000)) {
    throw new Error("VALID_SESSION_EXPIRY_REQUIRED");
  }
  const expiresAtMs = expiresAt * 1000;
  // PostgREST permits 30 seconds of clock skew. Observe beyond that grace
  // window, with another five seconds for the request boundary.
  const waitUntilMs = expiresAtMs + 35000;
  return { expiresAtMs, waitUntilMs, remainingMs: Math.max(0, waitUntilMs - nowMs) };
}

export function isExpiredJwtResponse(response) {
  return response?.status === 401 && ["PGRST301", "PGRST303"].includes(response.data?.code)
    && response.data?.message === "JWT expired";
}

// The publishable-key gateway can restrict OpenAPI even for signed-in users.
// Never introduce a secret key: require independent catalog and direct-RPC proof.
export function rpcSurfaceVerdict(response, catalogVerified, directRpcVerified) {
  if (directRpcVerified !== true) return false;
  if (response?.status === 200) {
    const paths = response.data?.paths;
    if (!paths || typeof paths !== "object" || Array.isArray(paths)) return false;
    return Object.keys(paths).filter(path => path !== "/").sort().join()
      === ["/rpc/create_profile", "/rpc/get_me", "/rpc/update_profile"].join();
  }
  const restricted = [401, 403].includes(response?.status)
    && (response.data?.message === "Secret API key required"
      || (response.data?.message === "Access to schema is forbidden"
        && response.data?.hint === "Accessing the schema via the Data API is only allowed using a secret API key."));
  return restricted ? (catalogVerified === true ? true : null) : false;
}

export async function readSessionWithoutRefresh(projectUrl, publishableKey, cookies) {
  let providerRequestAttempted = false;
  let cookieWriteAttempted = false;
  const reader = createServerClient(projectUrl, publishableKey, {
    // getSession can refresh even with autoRefreshToken=false. Block provider
    // traffic so an observation can never repair the session being tested.
    global: { fetch: async () => {
      providerRequestAttempted = true;
      return Response.json({ error: "SESSION_OBSERVATION_ONLY" }, { status: 401 });
    } },
    cookies: { getAll: () => cookies, setAll: () => { cookieWriteAttempted = true; } },
  });
  const { data, error } = await reader.auth.getSession();
  return !error && !providerRequestAttempted && !cookieWriteAttempted ? data.session : null;
}
