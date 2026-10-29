import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { localPostgresConnection } from "../local-postgres";

// Endpoint-level persistence and authorization: the REAL route handlers, server modules and client schemas run against a real migrated database (RLS in force, calls made
// as the `authenticated` role with the caller's claims). Only the Supabase transport is replaced by a thin shim that runs `api.<rpc>(jsonb)` in the database; nothing about
// authorization, validation or persistence is mocked. Every response is parsed with the same schema the browser uses, so a frontend/API mismatch fails here.
const db = process.env.FAIRWORK_LOCAL_POSTGRES_PORT ? await localPostgresConnection() : new PGlite();
let actor: string | null = null;
const rpcShim = async (name: string, args: Record<string, unknown>) => {
  const value = Object.values(args)[0];
  await db.exec("begin; set local role authenticated");
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: actor, role: "authenticated", aal: "aal2", is_anonymous: false })]);
    const result = await db.query<{ data: unknown }>(`select api.${name}($1::jsonb) data`, [JSON.stringify(value)]);
    await db.exec("commit");
    return { data: result.rows[0]!.data, error: null };
  } catch (error) {
    await db.exec("rollback");
    return { data: null, error: { code: (error as { code?: string }).code, message: (error as Error).message } };
  }
};
vi.mock("@/server/supabase", () => ({
  createServerSupabase: async () => ({
    auth: { getUser: async () => actor ? { data: { user: { id: actor, is_anonymous: false } }, error: null } : { data: { user: null }, error: { status: 401, message: "no session" } } },
    rpc: rpcShim,
  }),
}));

import * as meRoute from "@/app/api/v1/me/route";
import * as offersRoute from "@/app/api/v1/offers/route";
import * as lifecycleRoute from "@/app/api/v1/offers/lifecycle/route";
import * as draftsRoute from "@/app/api/v1/offers/drafts/route";
import * as agreementsRoute from "@/app/api/v1/agreements/route";
import * as notificationsRoute from "@/app/api/v1/notifications/route";
import * as workRecordsRoute from "@/app/api/v1/work-records/route";
import * as passportRoute from "@/app/api/v1/passport/route";
import * as casesRoute from "@/app/api/v1/work-cases/route";
import { meSchema } from "@/features/identity/schema";
import { offerListSchema } from "@/features/offer/list-schema";
import { draftPage, draftReceipt } from "@/features/offer/draft-schema";
import { offerLifecycleResult } from "@/features/offer/lifecycle-schema";
import { notificationList } from "@/features/identity/notifications-schema";
import { workListSchema } from "@/features/work/schema";
import { passportSchema } from "@/features/work/passport-schema";

const ORIGIN = "http://127.0.0.1:3100";
const operator = randomUUID(), representative = randomUUID(), worker = randomUUID(), other = randomUUID(), newcomer = randomUUID();
const offer = randomUUID(), draft = randomUUID();
let company = "";
const call = (handler: (request: Request) => Promise<Response>, method: string, path: string, body?: unknown, as: string | null = worker, headers: Record<string, string> = {}) => {
  actor = as;
  return handler(new Request(`${ORIGIN}${path}`, { method, headers: { origin: ORIGIN, "content-type": "application/json", ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
};
const data = async (response: Response) => (await response.json()).data;
const rpcAs = async (as: string, name: string, request: unknown) => { actor = as; const r = await rpcShim(name, { request }); if (r.error) throw new Error(`${name}: ${r.error.message}`); return r.data as Record<string, unknown>; };

beforeEach(() => { vi.stubEnv("APP_ORIGIN", ORIGIN); vi.stubEnv("FAIRWORK_DATA_MODE", "synthetic"); });
afterAll(() => db.close());
beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;");
  for (const file of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  for (const id of [operator, representative, worker, other, newcomer]) await db.query("insert into auth.users values($1)", [id]);
  for (const id of [operator, representative, worker, other]) await db.query("insert into private.profiles(id,display_name) values($1,'Synthetic fixture')", [id]);
  await db.query("insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at) values($1,'authority_operator',$2,'Synthetic test only',now()+interval '1 day')", [operator, other]);
  company = (await rpcAs(operator, "provision_company", { name: "Synthetic route company", idempotencyKey: randomUUID() })).id as string;
  await rpcAs(operator, "decide_membership", { companyId: company, subjectId: representative, decision: "approve", expectedRevision: 0, expiresAt: new Date(Date.now() + 86400000).toISOString(), reviewedEvidenceRefs: ["demo:fixture/routes"], reason: "Synthetic route test authority", policyVersion: "demo-authority.v1", idempotencyKey: randomUUID() });
  await rpcAs(representative, "review_offer", { offerId: offer, companyId: company, workerId: worker, requesterRole: "EMPLOYER", terms: { role: "Synthetic role", salary: 100, currency: "LKR", hoursPerWeek: 40, responsibilities: "Synthetic work", startDate: "2026-11-01" }, expectedVersion: 1, idempotencyKey: randomUUID() });
}, 240000);

describe("identity and profile", () => {
  it("rejects anonymous callers on every checked endpoint", async () => {
    for (const [handler, path] of [[meRoute.GET, "/api/v1/me"], [offersRoute.GET, "/api/v1/offers"], [draftsRoute.GET, "/api/v1/offers/drafts"], [notificationsRoute.GET, "/api/v1/notifications"], [workRecordsRoute.GET, "/api/v1/work-records"], [passportRoute.GET, "/api/v1/passport"], [casesRoute.GET, "/api/v1/work-cases"]] as const) {
      expect((await call(handler, "GET", path, undefined, null)).status, path).toBe(401);
    }
  });
  it("creates a profile once, returns it on a new session and persists an update", async () => {
    const key = randomUUID();
    const created = await call(meRoute.POST, "POST", "/api/v1/me", { displayName: "Synthetic newcomer", locale: "en", timeZone: "UTC" }, newcomer, { "idempotency-key": key });
    expect(created.status).toBe(200);
    const first = meSchema.parse(await data(created));
    expect((await call(meRoute.POST, "POST", "/api/v1/me", { displayName: "Synthetic newcomer", locale: "en", timeZone: "UTC" }, newcomer, { "idempotency-key": key })).status).toBe(200);
    const again = meSchema.parse(await data(await call(meRoute.GET, "GET", "/api/v1/me", undefined, newcomer)));
    expect(again).toMatchObject({ id: newcomer, displayName: "Synthetic newcomer" });
    const updated = await call(meRoute.PATCH, "PATCH", "/api/v1/me", { displayName: "Renamed newcomer", locale: "en", timeZone: "UTC", expectedRevision: first.revision }, newcomer, { "idempotency-key": randomUUID() });
    expect(updated.status).toBe(200);
    expect(meSchema.parse(await data(await call(meRoute.GET, "GET", "/api/v1/me", undefined, newcomer))).displayName).toBe("Renamed newcomer");
    expect((await call(meRoute.PATCH, "PATCH", "/api/v1/me", { displayName: "Stale", locale: "en", timeZone: "UTC", expectedRevision: first.revision }, newcomer, { "idempotency-key": randomUUID() })).status).toBe(409);
    expect((await call(meRoute.GET, "GET", "/api/v1/me?x=1", undefined, newcomer)).status).toBe(422);
  });
  it("rejects a foreign origin and an unknown field before touching the database", async () => {
    expect((await call(meRoute.PATCH, "PATCH", "/api/v1/me", { displayName: "X", locale: "en", timeZone: "UTC", expectedRevision: 1 }, newcomer, { origin: "https://evil.example", "idempotency-key": randomUUID() })).status).toBe(403);
    expect((await call(meRoute.PATCH, "PATCH", "/api/v1/me", { displayName: "X", locale: "en", timeZone: "UTC", expectedRevision: 1, id: worker }, newcomer, { "idempotency-key": randomUUID() })).status).toBe(422);
  });
});

describe("offers: the list contract the browser and the hosted journeys rely on", () => {
  it("answers the exact URLs the application uses and persists across sessions", async () => {
    for (const path of ["/api/v1/offers", "/api/v1/offers?context=WORKER&view=active", "/api/v1/offers?context=WORKER&view=all", "/api/v1/offers?context=EMPLOYER&view=active"]) {
      const response = await call(offersRoute.GET, "GET", path);
      expect(response.status, path).toBe(200);
      offerListSchema.parse(await data(response));
    }
    const mine = offerListSchema.parse(await data(await call(offersRoute.GET, "GET", "/api/v1/offers?context=WORKER&view=active")));
    expect(mine.items).toMatchObject([{ offerId: offer, companyId: company, role: "Synthetic role" }]);
    expect(offerListSchema.parse(await data(await call(offersRoute.GET, "GET", "/api/v1/offers?context=EMPLOYER&view=active", undefined, representative))).items.map(i => i.offerId)).toEqual([offer]);
  });
  it("refuses `?limit=5` with 422 because the contract is context, view and cursor only (page size is fixed by the server)", async () => {
    expect((await call(offersRoute.GET, "GET", "/api/v1/offers?limit=5")).status).toBe(422);
    expect((await call(offersRoute.GET, "GET", `/api/v1/offers?workerId=${other}`)).status).toBe(422);
    expect((await call(offersRoute.GET, "GET", "/api/v1/offers?context=WORKER&context=EMPLOYER")).status).toBe(422);
    expect((await call(offersRoute.GET, "GET", "/api/v1/offers?view=deleted")).status).toBe(422);
    expect((await call(offersRoute.GET, "GET", "/api/v1/offers?cursor=not-a-uuid")).status).toBe(422);
  });
  it("shows nothing to an unrelated account and nothing to a worker asking for the employer context", async () => {
    expect(offerListSchema.parse(await data(await call(offersRoute.GET, "GET", "/api/v1/offers?context=WORKER&view=all", undefined, other))).items).toEqual([]);
    expect(offerListSchema.parse(await data(await call(offersRoute.GET, "GET", "/api/v1/offers?context=EMPLOYER&view=all", undefined, worker))).items).toEqual([]);
  });
  it("archives through the lifecycle endpoint, persists it, and refuses a stale revision and a stranger", async () => {
    const body = { offerId: offer, archived: true, decision: "interested", expectedRevision: 0, idempotencyKey: randomUUID() };
    const done = await call(lifecycleRoute.POST, "POST", "/api/v1/offers/lifecycle", body);
    expect(offerLifecycleResult.parse(await data(done))).toEqual({ saved: true, revision: 1 });
    expect(offerListSchema.parse(await data(await call(offersRoute.GET, "GET", "/api/v1/offers?context=WORKER&view=active"))).items).toEqual([]);
    expect(offerListSchema.parse(await data(await call(offersRoute.GET, "GET", "/api/v1/offers?context=WORKER&view=archived"))).items).toMatchObject([{ offerId: offer, archived: true, decision: "interested" }]);
    expect((await call(lifecycleRoute.POST, "POST", "/api/v1/offers/lifecycle", { ...body, idempotencyKey: randomUUID() })).status).toBe(409);
    expect((await call(lifecycleRoute.POST, "POST", "/api/v1/offers/lifecycle", { ...body, expectedRevision: 1, idempotencyKey: randomUUID() }, other)).status).toBeGreaterThanOrEqual(403);
    await call(lifecycleRoute.POST, "POST", "/api/v1/offers/lifecycle", { ...body, archived: false, expectedRevision: 1, idempotencyKey: randomUUID() });
  });
  it("reads the agreement only for a participant", async () => {
    expect((await call(agreementsRoute.GET, "GET", `/api/v1/agreements?offerId=${offer}`)).status).toBe(200);
    expect((await call(agreementsRoute.GET, "GET", `/api/v1/agreements?offerId=${offer}`, undefined, representative)).status).toBe(200);
    expect((await call(agreementsRoute.GET, "GET", `/api/v1/agreements?offerId=${offer}`, undefined, other)).status).toBe(404);
  });
});

describe("drafts survive a refresh and a new login, and belong to their owner", () => {
  it("saves, lists, versions and isolates", async () => {
    const save = { operation: "save", id: draft, expectedRevision: 0, idempotencyKey: randomUUID(), content: { role: "Technician", employer: "Reported employer", text: "Pay not yet agreed" } };
    expect(draftReceipt.parse(await data(await call(draftsRoute.POST, "POST", "/api/v1/offers/drafts", save)))).toEqual({ id: draft, revision: 1, saved: true });
    const listed = draftPage.parse(await data(await call(draftsRoute.GET, "GET", "/api/v1/offers/drafts")));
    expect(listed.items).toMatchObject([{ id: draft, revision: 1, content: save.content }]);
    expect(draftPage.parse(await data(await call(draftsRoute.GET, "GET", "/api/v1/offers/drafts", undefined, other))).items).toEqual([]);
    // The same client-chosen id used by another account is a separate draft of that account: it neither fails nor touches the owner's.
    const theirs = { ...save, idempotencyKey: randomUUID(), content: { ...save.content, text: "Someone else's notes" } };
    expect(draftReceipt.parse(await data(await call(draftsRoute.POST, "POST", "/api/v1/offers/drafts", theirs, other)))).toEqual({ id: draft, revision: 1, saved: true });
    expect(draftPage.parse(await data(await call(draftsRoute.GET, "GET", "/api/v1/offers/drafts"))).items).toMatchObject([{ id: draft, content: save.content }]);
    expect(draftPage.parse(await data(await call(draftsRoute.GET, "GET", "/api/v1/offers/drafts", undefined, other))).items).toMatchObject([{ id: draft, content: theirs.content }]);
    expect((await call(draftsRoute.POST, "POST", "/api/v1/offers/drafts", { ...theirs, idempotencyKey: randomUUID() }, other)).status).toBe(409);
    expect((await call(draftsRoute.GET, "GET", "/api/v1/offers/drafts?limit=5")).status).toBe(422);
  });
});

describe("work records, Passport, cases and notifications answer honestly for a new account", () => {
  it("returns empty, schema-valid lists for the signed-in worker and refuses unexpected parameters", async () => {
    expect(workListSchema.parse(await data(await call(workRecordsRoute.GET, "GET", "/api/v1/work-records"))).items).toEqual([]);
    expect(passportSchema.parse(await data(await call(passportRoute.GET, "GET", "/api/v1/passport"))).entries).toEqual([]);
    expect((await call(casesRoute.GET, "GET", "/api/v1/work-cases")).status).toBe(200);
    expect(notificationList.parse(await data(await call(notificationsRoute.GET, "GET", "/api/v1/notifications"))).items).toBeInstanceOf(Array);
    expect((await call(notificationsRoute.GET, "GET", "/api/v1/notifications?limit=5")).status).toBe(422);
    expect((await call(workRecordsRoute.GET, "GET", "/api/v1/work-records?workId=not-a-uuid")).status).toBe(422);
    expect((await call(workRecordsRoute.GET, "GET", `/api/v1/work-records?workId=${randomUUID()}`)).status).toBe(404);
  });
});

// Read sweep: every GET route the application uses, called as a plain signed-in worker with the exact URL shapes from the frontend. A 5xx here means the database answered
// something the route's response schema (or the route itself) cannot handle, which users would see as data that fails to load. A random identifier must read as "not found",
// never as a server error, and anonymous callers must be refused wherever the route requires a session.
describe("read sweep over the routes the frontend calls", () => {
  const id = () => randomUUID();
  const targets: [string, string, string][] = [
    ["entitlements", "/api/v1/entitlements", "@/app/api/v1/entitlements/route"],
    ["guidance", "/api/v1/guidance", "@/app/api/v1/guidance/route"],
    ["opportunities", "/api/v1/opportunities?view=discover", "@/app/api/v1/opportunities/route"],
    ["organizations", "/api/v1/organizations", "@/app/api/v1/organizations/route"],
    ["research history", "/api/v1/research/history", "@/app/api/v1/research/history/route"],
    ["vault", "/api/v1/vault", "@/app/api/v1/vault/route"],
    ["vault status", "/api/v1/vault/status", "@/app/api/v1/vault/status/route"],
    ["privacy requests", "/api/v1/privacy-requests", "@/app/api/v1/privacy-requests/route"],
    ["reports", "/api/v1/reports", "@/app/api/v1/reports/route"],
    ["credentials", "/api/v1/credentials", "@/app/api/v1/credentials/route"],
    ["passport sharing", "/api/v1/passport/sharing", "@/app/api/v1/passport/sharing/route"],
    ["agreement expiries", "/api/v1/agreement-expiries", "@/app/api/v1/agreement-expiries/route"],
    ["employment history", "/api/v1/me/employment-history", "@/app/api/v1/me/employment-history/route"],
    ["developer keys", "/api/v1/developer/keys", "@/app/api/v1/developer/keys/route"],
    ["platform notices", "/api/v1/platform-notices", "@/app/api/v1/platform-notices/route"],
    ["agreement workflows", `/api/v1/agreement-workflows?agreementId=${id()}`, "@/app/api/v1/agreement-workflows/route"],
    ["offer history", `/api/v1/offers/history?offerId=${id()}`, "@/app/api/v1/offers/history/route"],
    ["offer analyses", `/api/v1/offers/analyses?offerId=${id()}`, "@/app/api/v1/offers/analyses/route"],
    ["offer assessment", `/api/v1/offers/assessment?offerId=${id()}`, "@/app/api/v1/offers/assessment/route"],
    ["offer notes", `/api/v1/offers/notes?offerId=${id()}`, "@/app/api/v1/offers/notes/route"],
    ["case evidence", `/api/v1/work-cases/evidence?caseId=${id()}`, "@/app/api/v1/work-cases/evidence/route"],
    ["case followups", `/api/v1/case-followups?caseId=${id()}`, "@/app/api/v1/case-followups/route"],
    ["vault attachments", `/api/v1/vault/attachments?workId=${id()}`, "@/app/api/v1/vault/attachments/route"],
    ["agreement expiry", `/api/v1/agreement-expiry?agreementId=${id()}`, "@/app/api/v1/agreement-expiry/route"],
  ];
  it.each(targets)("%s answers a worker without a server error", async (_name, path, module) => {
    const handler = (await import(/* @vite-ignore */ module) as { GET: (request: Request) => Promise<Response> }).GET;
    const response = await call(handler, "GET", path);
    expect(response.status, `${path} -> ${response.status}`).toBeLessThan(500);
    expect([200, 403, 404], `${path} -> ${response.status}`).toContain(response.status);
    if (response.status === 200) expect(await response.json()).toHaveProperty("data");
    const anonymous = await call(handler, "GET", path, undefined, null);
    expect([200, 401, 403, 404], `${path} anonymous -> ${anonymous.status}`).toContain(anonymous.status);
    if (anonymous.status === 200) expect(["platform notices"], `${path} must not answer anonymous callers`).toContain(_name);
  });
});
