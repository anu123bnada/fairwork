// Run locally. Credentials are entered without echo and kept only in memory.
// No traces, screenshots, storageState, response bodies or credential files.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
import { profileProbe } from "./profile-probe.mjs";
import { expiryWaitPlan, isExpiredJwtResponse, readSessionWithoutRefresh, rpcSurfaceVerdict, validCatalogReport } from "./day1-verification-inputs.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
if (process.env.DEBUG || process.env.PWDEBUG || process.env.NODE_DEBUG || process.env.NODE_OPTIONS) {
  throw new Error("Clear debug/inspection environment options before credential verification.");
}
const publicOnly = process.argv.includes("--public");
const waitForExpiry = process.argv.includes("--wait-for-expiry");
const catalogReportPath = process.argv.find(x => x.startsWith("--catalog-report="))?.slice(17);
const env = parseEnv(readFileSync(root + ".env.local", "utf8"));
const origin = process.argv.find(x => x.startsWith("--origin="))?.slice(9) ?? env.APP_ORIGIN ?? "http://localhost:3000";
const project = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (project.protocol !== "https:" || !project.hostname.endsWith(".supabase.co") || !key?.startsWith("sb_publishable_")) {
  throw new Error("Expected hosted Supabase URL and public publishable key in .env.local.");
}
const local = new URL(origin);
if (local.origin !== origin || local.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(local.hostname)) {
  throw new Error("Run against a loopback Next.js application origin.");
}
const results = [];
let catalogVerified = false;
function record(check, ok, note = "") {
  const status = ok === null ? "UNVERIFIED" : ok ? "PASS" : "FAIL";
  results.push({ check, status, ...(note ? { note } : {}) });
  console.log(`${status}: ${check}${note ? ` (${note})` : ""}`);
  return ok;
}
function requireCheck(check, ok, note = "") {
  record(check, ok, note);
  if (!ok) throw new Error("CHECK_FAILED");
}
async function hidden(label) {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) throw new Error("INTERACTIVE_TERMINAL_REQUIRED");
  process.stdout.write(`${label} (hidden): `);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolve, reject) => {
    let value = "";
    function finish(cancelled) {
      process.stdin.off("data", input);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (cancelled) { value = ""; reject(new Error("CANCELLED")); }
      else resolve(value);
    }
    function input(chunk) {
      for (const character of chunk) {
        if (character === "\u0003") { finish(true); return; }
        if (character === "\r" || character === "\n") { finish(false); return; }
        if (character === "\u007f" || character === "\b") value = value.slice(0, -1);
        else if (character >= " " && character !== "\u001b") value += character;
      }
    }
    process.stdin.on("data", input);
  });
}
async function remote(path, { method = "GET", schema, token, body } = {}) {
  const response = await fetch(project.origin + path, {
    method, redirect: "error", signal: AbortSignal.timeout(20000),
    headers: { apikey: key, ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(schema ? { [method === "GET" ? "Accept-Profile" : "Content-Profile"]: schema } : {}),
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data; try { data = JSON.parse(text); } catch { data = null; }
  return { status: response.status, data };
}
async function app(page, path, method = "GET", body, requestKey, requestOrigin = origin) {
  return page.evaluate(async ({ path, method, body, requestKey, requestOrigin }) => {
    const response = await fetch(path, { method, credentials: "same-origin", redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: { ...(body !== undefined ? { "Content-Type": "application/json", Origin: requestOrigin } : {}),
        ...(requestKey ? { "Idempotency-Key": requestKey } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let data = null;
    try { data = await response.json(); } catch { /* Keep the HTTP status, never an HTML error body. */ }
    return { status: response.status, cache: response.headers.get("cache-control"), data };
  }, { path, method, body, requestKey, requestOrigin });
}
const profileInput = name => ({ displayName: name, locale: "en", timeZone: "UTC" });
const dtoKeys = ["capabilities", "displayName", "id", "locale", "revision", "timeZone"].sort().join();
const isDto = value => value && Object.keys(value).sort().join() === dtoKeys && Array.isArray(value.capabilities);
const tables = ["profiles", "capability_assignments", "audit_logs", "command_receipts", "rate_limit_buckets"];
const rpcs = ["create_profile", "get_me", "update_profile"];
function authCookies(cookies) {
  return cookies.filter(c => c.name.includes("auth-token") && c.value)
    .map(({ name, value }) => ({ name, value })).sort((a, b) => a.name.localeCompare(b.name));
}
async function observeNaturalRefresh(actor) {
  const beforeCookies = await actor.context.cookies(origin);
  const before = await readSessionWithoutRefresh(project.origin, key, beforeCookies);
  requireCheck("Expiry observation starts from an unchanged session without provider refresh",
    Boolean(before?.access_token && before?.refresh_token && before?.expires_at));
  actor.token = before.access_token;
  actor.refreshToken = before.refresh_token;
  const plan = expiryWaitPlan(before.expires_at);
  console.log(`Waiting for actual session expiry: approximately ${Math.ceil(plan.remainingMs / 60000)} minutes. No application polling or hosted settings changes.`);
  // This timer makes no Auth/application requests. Keep status output bounded
  // so an hour-long hosted expiry does not appear to be a hung verifier.
  let cancelWait;
  const interrupted = () => cancelWait?.();
  process.on("SIGINT", interrupted);
  try {
    while (Date.now() < plan.waitUntilMs) {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, Math.min(30000, plan.waitUntilMs - Date.now()));
        cancelWait = () => { clearTimeout(timer); reject(new Error("EXPIRY_WAIT_CANCELLED")); };
      });
      if (Date.now() < plan.waitUntilMs) console.log(`Expiry wait: ${Math.ceil((plan.waitUntilMs - Date.now()) / 60000)} minute(s) remaining.`);
    }
  } finally {
    process.off("SIGINT", interrupted);
  }
  const untouched = await actor.context.cookies(origin);
  requireCheck("Browser session stayed unchanged throughout the natural expiry wait",
    JSON.stringify(authCookies(untouched)) === JSON.stringify(authCookies(beforeCookies)));
  const expired = await remote("/rest/v1/rpc/get_me", { method: "POST", schema: "api", token: before.access_token, body: { request: {} } });
  requireCheck("Previously issued access token is rejected after natural expiry", isExpiredJwtResponse(expired));
  const refreshed = await app(actor.page, "/api/v1/me");
  requireCheck("Expired browser session refreshes through the application",
    refreshed.status === 200 && refreshed.data?.data?.id === actor.id && refreshed.cache === "private, no-store");
  const afterCookies = await actor.context.cookies(origin);
  requireCheck("Application persisted refreshed session cookies",
    authCookies(afterCookies).length > 0 && JSON.stringify(authCookies(afterCookies)) !== JSON.stringify(authCookies(beforeCookies)));
  const after = await readSessionWithoutRefresh(project.origin, key, afterCookies);
  requireCheck("Refreshed application session has a new token and future expiry",
    Boolean(after?.access_token && after?.refresh_token && after.access_token !== before.access_token
      && after.expires_at > before.expires_at && after.expires_at * 1000 > Date.now()));
  actor.token = after.access_token;
  actor.refreshToken = after.refresh_token;
  const identity = await remote("/auth/v1/user", { token: actor.token });
  requireCheck("Application refresh preserves the verified synthetic identity", identity.status === 200 && identity.data?.id === actor.id);
  record("Natural expiry and automatic application refresh", true);
}
async function surface(token, prefix, directRpcVerified = false) {
  for (const schema of ["private", "public", "auth", "storage", "graphql_public"]) {
    const r = await remote("/rest/v1/profiles?select=id&limit=1", { schema, token });
    record(`${prefix}: ${schema} schema unavailable`, r.status === 406 && r.data?.code === "PGRST106");
  }
  for (const table of tables) {
    const r = await remote(`/rest/v1/${table}?select=*&limit=1`, { schema: "api", token });
    record(`${prefix}: api.${table} unavailable`, r.status === 404 && r.data?.code === "PGRST205");
  }
  const unknown = await remote("/rest/v1/rpc/not_a_fairwork_rpc", { method: "POST", schema: "api", token, body: { request: {} } });
  record(`${prefix}: unknown RPC unavailable`, unknown.status === 404 && unknown.data?.code === "PGRST202");
  const spec = await remote("/rest/v1/", { schema: "api", token });
  if (token) {
    const verified = rpcSurfaceVerdict(spec, catalogVerified, directRpcVerified);
    record("Authenticated RPC surface matches the approved inventory and direct probes", verified,
      `HTTP ${spec.status}; ${spec.status === 200 ? "OpenAPI inventory checked" : verified !== false ? "gateway restricts OpenAPI; exact inventory requires separate current catalog evidence" : "unexpected response or missing direct-RPC proof"}`);
    if (verified === false) throw new Error("CHECK_FAILED");
  } else record("Anonymous PostgREST schema enumeration denied", spec.status === 401 || spec.status === 403);
}
let browser;
const actors = [];
try {
  console.log("FAIRWORK hosted verification: synthetic accounts only; no credential output or persistence.");
  if (catalogReportPath) {
    let report;
    try { report = JSON.parse(readFileSync(catalogReportPath, "utf8")); } catch { /* Never print the path or supplied contents. */ }
    catalogVerified = validCatalogReport(report, project.hostname.split(".")[0]);
    requireCheck("Hosted catalog", catalogVerified, "Same-project evidence captured within one hour must contain exactly the current 16 unique PASS checks");
  } else record("Hosted catalog", null, "Run scripts/day1-hosted-catalog.sql; optionally supply its current owner-exported JSON with --catalog-report=<path>");
  if (publicOnly && waitForExpiry) throw new Error("EXPIRY_REQUIRES_INTERACTIVE_ACCOUNTS");
  const settings = await remote("/auth/v1/settings");
  requireCheck("Hosted Auth settings reachable", settings.status === 200);
  record("Public signup disabled", settings.data.disable_signup === true);
  record("Anonymous sign-in disabled", settings.data.external?.anonymous_users === false);
  record("Email/password provider enabled", settings.data.external?.email === true);
  await surface(undefined, "Publishable key");
  for (const name of rpcs) {
    const r = await remote(`/rest/v1/rpc/${name}`, { method: "POST", schema: "api", body: { request: {} } });
    record(`Anonymous ${name} execution denied`, [401, 403].includes(r.status) && r.data?.code === "42501");
  }
  browser = await chromium.launch();
  const anonymous = await browser.newContext();
  const page = await anonymous.newPage();
  let hydrationWarning = false;
  page.on("console", message => { if (/hydration|hydrated|server rendered HTML/i.test(message.text())) hydrationWarning = true; });
  await page.goto(origin, { waitUntil: "networkidle" });
  record("Configured Next.js checkpoint renders", (await page.textContent("body")).includes("Supabase connection configured"));
  record("Clean Chromium has no observed hydration warning", !hydrationWarning);
  record("Clean DOM has no reported extension attributes", !(await page.content()).match(/bis_skin_checked|__processed_|bis_register/));
  const denied = await app(page, "/api/v1/me");
  record("Unauthenticated GET fails closed with no-store", denied.status === 401 && denied.data?.error?.code === "AUTH_REQUIRED" && denied.cache === "private, no-store");
  for (const method of ["POST", "PATCH"]) {
    const r = await app(page, "/api/v1/me", method, { ...profileInput("Synthetic anonymous probe"), ...(method === "PATCH" ? { expectedRevision: 1 } : {}) }, crypto.randomUUID());
    record(`Unauthenticated ${method} fails closed`, r.status === 401 && r.data?.error?.code === "AUTH_REQUIRED");
  }
  for (const requestOrigin of [undefined, "https://invalid-origin.example.invalid"]) {
    const response = await fetch(origin + "/api/v1/me", { method: "POST", redirect: "error", signal: AbortSignal.timeout(20000),
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID(), ...(requestOrigin ? { Origin: requestOrigin } : {}) },
      body: JSON.stringify(profileInput("Synthetic origin probe")),
    });
    const data = await response.json();
    record(requestOrigin ? "Cross-origin mutation rejected" : "Missing-Origin mutation rejected", response.status === 403 && data?.error?.code === "ACTION_FORBIDDEN");
  }
  const invalid = await app(page, "/api/v1/auth/sign-in", "POST", { email: `not-provisioned-${crypto.randomUUID()}@example.invalid`, password: crypto.randomUUID() });
  record("Invalid credentials return only safe generic error", invalid.status === 401 && invalid.data?.error?.code === "AUTH_REQUIRED" && invalid.data.error.message === "Sign in to continue." && Object.keys(invalid.data).sort().join() === "error,meta" && Object.keys(invalid.data.error).sort().join() === "code,message" && invalid.cache === "private, no-store");
  await anonymous.close();
  if (publicOnly) {
    for (const name of ["Provisioned sign-in and browser session", "Profile create/read/update", "User A/B isolation", "Authenticated RPC surface", "Auth metadata escalation resistance", "Sign-out and refresh revocation", "Natural expiry and automatic application refresh"]) record(name, null, "Requires owner-local interactive verification");
  } else {
    console.log("Use two distinct ordinary synthetic accounts without operator capabilities. Existing display fields will be restored; revisions advance. Newly created synthetic profiles remain. Metadata probes restore prior values; previously absent probe keys become null. Never run with real users.");
    for (const label of ["A", "B"]) {
      let email = await hidden(`User ${label} email`);
      let password = await hidden(`User ${label} password`);
      const context = await browser.newContext();
      const userPage = await context.newPage();
      await userPage.goto(origin);
      const actor = { label, context, page: userPage, signedIn: false };
      actors.push(actor);
      const wrongPassword = await app(userPage, "/api/v1/auth/sign-in", "POST", { email, password: crypto.randomUUID() });
      requireCheck(`User ${label}: wrong password has same generic error as unknown account`, wrongPassword.status === 401 && wrongPassword.data?.error?.code === "AUTH_REQUIRED" && wrongPassword.data.error.message === "Sign in to continue.");
      const login = await app(userPage, "/api/v1/auth/sign-in", "POST", { email, password });
      email = ""; password = "";
      requireCheck(`User ${label}: provisioned email/password sign-in`, login.status === 200 && login.data?.data?.signedIn === true && Object.keys(login.data.data).join() === "signedIn");
      actor.signedIn = true;
      const cookies = await context.cookies(origin);
      record(`User ${label}: browser stored SameSite=Lax session cookie`, cookies.some(c => c.name.includes("auth-token") && c.sameSite === "Lax"));
      const sdk = createServerClient(project.origin, key, { cookies: { getAll: () => cookies, setAll: () => {} } });
      const session = (await sdk.auth.getSession()).data.session;
      requireCheck(`User ${label}: application cookie carries session`, Boolean(session?.access_token && session?.refresh_token));
      actor.token = session.access_token; actor.refreshToken = session.refresh_token;
      requireCheck(`User ${label}: distinct account before profile writes`, actors.every(other => other === actor || other.id !== session.user.id));
      await userPage.reload();
      let own = await app(userPage, "/api/v1/me");
      record(`User ${label}: browser retains session cookie after reload`, (await context.cookies(origin)).some(c => c.name.includes("auth-token") && c.value));
      const probe = profileProbe(own);
      if (!probe.available) {
        // Read-only differential probes. Never include provider messages or bodies.
        const identity = await remote("/auth/v1/user", { token: actor.token });
        record(`User ${label}: direct Auth identity accepted`, identity.status === 200, `HTTP ${identity.status}`);
        const rpc = await remote("/rest/v1/rpc/get_me", { method: "POST", schema: "api", token: actor.token, body: { request: {} } });
        const codes = ["42501", "P0001", "42883", "42P01", "42P17", "PGRST106", "PGRST202", "PGRST301", "PGRST302"];
        const code = codes.includes(rpc.data?.code) ? rpc.data.code : "OTHER";
        const expectedMissing = rpc.status === 400 && rpc.data?.code === "P0001" && rpc.data?.message === "NOT_FOUND";
        record(`User ${label}: direct profile RPC available`, rpc.status === 200 || expectedMissing, `HTTP ${rpc.status}; database code ${code}`);
      }
      requireCheck(`User ${label}: authenticated profile endpoint available after reload`, probe.available, probe.note);
      if (own.status === 404) {
        const input = profileInput(`Synthetic live verification ${label}`);
        const requestKey = crypto.randomUUID();
        own = await app(userPage, "/api/v1/me", "POST", input, requestKey);
        requireCheck(`User ${label}: profile create`, own.status === 200 && isDto(own.data?.data));
        const replay = await app(userPage, "/api/v1/me", "POST", input, requestKey);
        record(`User ${label}: create replay does not change revision`, replay.status === 200 && replay.data.data.revision === own.data.data.revision && replay.data.data.id === own.data.data.id);
      } else record(`User ${label}: profile create`, null, "Profile already exists; use a fresh synthetic account to verify creation");
      requireCheck(`User ${label}: fixed own-profile DTO without capabilities`, own.status === 200 && isDto(own.data?.data) && own.data.data.capabilities.length === 0);
      actor.original = own.data.data;
      actor.id = own.data.data.id;
      const changed = { ...profileInput(`Synthetic verification updated ${label}`), expectedRevision: own.data.data.revision };
      const requestKey = crypto.randomUUID();
      const update = await app(userPage, "/api/v1/me", "PATCH", changed, requestKey);
      requireCheck(`User ${label}: revisioned profile update`, update.status === 200 && update.data?.data?.revision === changed.expectedRevision + 1 && update.data.data.displayName === changed.displayName);
      const replay = await app(userPage, "/api/v1/me", "PATCH", changed, requestKey);
      record(`User ${label}: update replay is idempotent`, replay.status === 200 && replay.data.data.revision === update.data.data.revision);
      const conflict = await app(userPage, "/api/v1/me", "PATCH", { ...changed, displayName: "Synthetic changed body" }, requestKey);
      record(`User ${label}: changed-body replay rejected`, conflict.status === 409 && conflict.data?.error?.code === "IDEMPOTENCY_CONFLICT");
      const stale = await app(userPage, "/api/v1/me", "PATCH", changed, crypto.randomUUID());
      record(`User ${label}: stale revision rejected`, stale.status === 409 && stale.data?.error?.code === "VERSION_CONFLICT");
    }
    const [a, b] = actors;
    requireCheck("A and B are distinct authenticated identities", a.id !== b.id);
    for (const [actor, other] of [[a, b], [b, a]]) {
      const before = await app(other.page, "/api/v1/me");
      const own = await app(actor.page, "/api/v1/me");
      record(`User ${actor.label}: GET returns only own ID`, own.status === 200 && own.data?.data?.id === actor.id && own.data.data.id !== other.id);
      const selector = await app(actor.page, `/api/v1/me?id=${other.id}`);
      record(`User ${actor.label}: cross-user read selector rejected`, selector.status === 422);
      for (const field of ["id", "actorId", "role", "capabilities", "account_state"]) {
        const injected = await app(actor.page, "/api/v1/me", "PATCH", { ...profileInput("Synthetic denied mutation"), expectedRevision: own.data.data.revision, [field]: field === "id" || field === "actorId" ? other.id : "ADMIN" }, crypto.randomUUID());
        record(`User ${actor.label}: profile ${field} injection rejected`, injected.status === 422 && injected.data?.error?.code === "VALIDATION_FAILED");
      }
      const missingKey = await app(actor.page, "/api/v1/me", "PATCH", { ...profileInput("Synthetic missing key"), expectedRevision: own.data.data.revision });
      record(`User ${actor.label}: missing idempotency key rejected`, missingKey.status === 422);
      for (const [name, request] of [["get_me", { id: other.id }], ["create_profile", { ...profileInput("Synthetic denied creation"), idempotencyKey: crypto.randomUUID(), role: "ADMIN" }], ["update_profile", { ...profileInput("Synthetic denied RPC"), expectedRevision: own.data.data.revision, idempotencyKey: crypto.randomUUID(), id: other.id, role: "ADMIN" }]]) {
        const injected = await remote(`/rest/v1/rpc/${name}`, { method: "POST", schema: "api", token: actor.token, body: { request } });
        record(`User ${actor.label}: direct ${name} injection rejected`, injected.status === 400 && injected.data?.message === "VALIDATION_FAILED");
      }
      const after = await app(other.page, "/api/v1/me");
      record(`User ${actor.label}: other user's profile unchanged by probes`, JSON.stringify(before.data?.data) === JSON.stringify(after.data?.data));
    }
    await surface(a.token, "Authenticated user", rpcs.every(name => results.some(result =>
      result.check === `User A: direct ${name} injection rejected` && result.status === "PASS")));
    // An ordinary user's writable Auth metadata must never become authority.
    const user = await remote("/auth/v1/user", { token: a.token });
    requireCheck("Read own Auth metadata for reversible probe", user.status === 200);
    a.metadataRestore = { role: null, capabilities: null, ...(user.data.user_metadata ?? {}) };
    const metadata = await remote("/auth/v1/user", { method: "PUT", token: a.token, body: { data: { role: "ADMIN", capabilities: ["authority_operator", "privacy_operator"] } } });
    requireCheck("Ordinary Auth metadata probe applied", metadata.status === 200);
    const claimsAttempt = await remote("/rest/v1/rpc/get_me", { method: "POST", schema: "api", token: a.token, body: { request: {} } });
    record("Forged Auth metadata cannot grant protected capabilities", claimsAttempt.status === 200 && claimsAttempt.data?.capabilities?.length === 0);
    // Obtain a fresh token carrying the metadata; old JWT-only checks are insufficient.
    const refreshed = await remote("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: a.refreshToken } });
    requireCheck("Refresh issued token for metadata escalation test", refreshed.status === 200 && Boolean(refreshed.data?.access_token));
    a.token = refreshed.data.access_token; a.refreshToken = refreshed.data.refresh_token;
    const freshClaims = await remote("/rest/v1/rpc/get_me", { method: "POST", schema: "api", token: a.token, body: { request: {} } });
    record("Fresh JWT with forged user metadata grants no capabilities", freshClaims.status === 200 && freshClaims.data?.capabilities?.length === 0);
    // Refreshing A for the direct JWT test rotates its token. Rehydrate its browser
    // cookies using the SSR encoder, without writing a session file.
    const sessionCookies = [];
    const encoder = createServerClient(project.origin, key, { cookieOptions: { sameSite: "lax", secure: true, path: "/" }, cookies: { getAll: () => [], setAll: values => sessionCookies.push(...values) } });
    const encoded = await encoder.auth.setSession({ access_token: a.token, refresh_token: a.refreshToken });
    requireCheck("Refreshed session is encoded before replacing browser cookies",
      !encoded.error && Boolean(encoded.data?.session?.access_token && encoded.data?.session?.refresh_token)
      && authCookies(sessionCookies).length > 0);
    a.token = encoded.data.session.access_token;
    a.refreshToken = encoded.data.session.refresh_token;
    for (const { name } of (await a.context.cookies(origin)).filter(c => c.name.includes("auth-token"))) {
      await a.context.clearCookies({ name });
    }
    await a.context.addCookies(sessionCookies.map(({ name, value, options }) => ({ name, value, url: origin, sameSite: "Lax", secure: options.secure ?? false })));
    if (waitForExpiry) await observeNaturalRefresh(a);
    else record("Natural expiry and automatic application refresh", null, "Use --wait-for-expiry to observe actual token expiry and application-driven refresh; explicit provider refresh alone is insufficient");
  }
} catch {
  // Never serialize thrown provider/browser errors: they may embed request data.
  record("Verification completed without interruption", false, "Aborted; check app availability, account inputs and preceding safe results. No error payload printed.");
} finally {
  for (const actor of actors) {
    try {
      // The expiry observation can outlast either actor's access token. Let the
      // application refresh first, then use its persisted current tokens for
      // metadata cleanup and the later sign-out/revocation check.
      let now;
      if (actor.original || actor.metadataRestore) {
        now = await app(actor.page, "/api/v1/me");
        requireCheck(`User ${actor.label}: application session available for cleanup`, now.status === 200 && now.data?.data?.id === actor.id);
        const current = await readSessionWithoutRefresh(project.origin, key, await actor.context.cookies(origin));
        requireCheck(`User ${actor.label}: cleanup uses current application session`, Boolean(current?.access_token && current?.refresh_token));
        actor.token = current.access_token;
        actor.refreshToken = current.refresh_token;
      }
      if (actor.metadataRestore && actor.token) {
        const restored = await remote("/auth/v1/user", { method: "PUT", token: actor.token, body: { data: actor.metadataRestore } });
        record(`User ${actor.label}: metadata cleanup`, restored.status === 200);
      }
      if (actor.original) {
        const { displayName, locale, timeZone } = actor.original;
        const restored = await app(actor.page, "/api/v1/me", "PATCH", { displayName, locale, timeZone, expectedRevision: now.data?.data?.revision }, crypto.randomUUID());
        record(`User ${actor.label}: original display fields restored`, restored.status === 200 && restored.data?.data?.displayName === displayName);
      }
    } catch { record(`User ${actor.label}: cleanup`, false, "Review synthetic profile/metadata locally; no private details emitted"); }
    try {
      if (actor.signedIn) {
        const logout = await app(actor.page, "/api/v1/auth/sign-out", "POST", {});
        record(`User ${actor.label}: application sign-out`, logout.status === 200 && logout.data?.data?.signedOut === true);
        await actor.page.reload();
        const denied = await app(actor.page, "/api/v1/me");
        record(`User ${actor.label}: signed-out browser denied`, denied.status === 401 && denied.data?.error?.code === "AUTH_REQUIRED");
        record(`User ${actor.label}: session cookies removed`, !(await actor.context.cookies(origin)).some(c => c.name.includes("auth-token") && c.value));
        if (actor.refreshToken) {
          const revoked = await remote("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: actor.refreshToken } });
          record(`User ${actor.label}: signed-out refresh token rejected`, [400, 401].includes(revoked.status) && !revoked.data?.access_token);
          if (revoked.data?.access_token) await remote("/auth/v1/logout?scope=local", { method: "POST", token: revoked.data.access_token });
        }
      }
    } catch { record(`User ${actor.label}: sign-out cleanup`, false, "Owner should revoke this synthetic session locally"); }
    actor.token = undefined; actor.refreshToken = undefined; actor.metadataRestore = undefined;
  }
  try { await browser?.close(); } catch { record("Browser cleanup", false); }
  const directory = root + "test-results/";
  mkdirSync(directory, { recursive: true });
  const filename = publicOnly ? "day1-hosted-public.json" : "day1-hosted-interactive.json";
  writeFileSync(directory + filename, JSON.stringify({ mode: publicOnly ? "public" : "interactive", timestamp: new Date().toISOString(), results }, null, 2) + "\n");
  console.log(`Sanitized verdicts saved to ignored test-results/${filename}; no credentials, IDs or payloads.`);
  process.exitCode = results.some(r => r.status === "FAIL") ? 1 : results.some(r => r.status === "UNVERIFIED") ? 2 : 0;
}
