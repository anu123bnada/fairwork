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
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: actor, role: "authenticated", aal: "aal2", is_anonymous: false, amr: [{ method: "totp", timestamp: Math.floor(Date.now() / 1000) }] })]);
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
import * as workflowRoute from "@/app/api/v1/agreement-workflows/route";
import { caseListSchema, caseReadSchema, caseReceiptSchema } from "@/features/cases/schema";
import * as sharingRoute from "@/app/api/v1/passport/sharing/route";
import { shareList, shareProjection, shareReceipt } from "@/features/work/sharing-schema";
import * as adminRoute from "@/app/api/v1/admin/route";
import * as auditChainRoute from "@/app/api/v1/admin/audit-chain/route";
import * as exportLogRoute from "@/app/api/v1/admin/export-log/route";
import { auditChainResult } from "@/features/admin/audit-chain";
import { twoAccountFlow } from "../../scripts/hosted-two-account-flow.mjs";
import { meSchema } from "@/features/identity/schema";
import { offerListSchema } from "@/features/offer/list-schema";
import { draftPage, draftReceipt } from "@/features/offer/draft-schema";
import { offerLifecycleResult } from "@/features/offer/lifecycle-schema";
import { notificationList } from "@/features/identity/notifications-schema";
import { workListSchema } from "@/features/work/schema";
import { passportSchema } from "@/features/work/passport-schema";

const ORIGIN = "http://127.0.0.1:3100";
const admin = randomUUID(), operator = randomUUID(), representative = randomUUID(), worker = randomUUID(), other = randomUUID(), newcomer = randomUUID();
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
  for (const id of [admin, operator, representative, worker, other, newcomer]) await db.query("insert into auth.users values($1)", [id]);
  await db.query("insert into private.profiles(id,display_name) values($1,'Synthetic admin')", [admin]);
  await db.query("insert into private.admin_roles(subject_id,role,expires_at,revision) values($1,'owner',now()+interval '1 day',1)", [admin]);
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

// The shared two-account journey (employer offer -> agreement proposal -> both parties confirm -> work record -> submission -> independent verification -> Passport), run
// through the real route handlers and persisted in the database, then re-read from fresh requests as each party.
let journey: { offerId: string; agreementId: string; workId: string };
describe("two-account journey through the real routes", () => {
  it("persists an agreement, a verified work record and the Passport, and denies self-verification and a client-chosen Passport owner", async () => {
    const handlers: Record<string, { GET: (request: Request) => Promise<Response>; POST: (request: Request) => Promise<Response> }> = {
      "/api/v1/offers": offersRoute as never, "/api/v1/agreements": agreementsRoute as never, "/api/v1/agreement-workflows": workflowRoute as never,
      "/api/v1/work-records": workRecordsRoute as never, "/api/v1/passport": passportRoute as never,
    };
    const evidence: string[] = [];
    journey = await twoAccountFlow({
      worker: { id: worker }, employer: { id: representative }, companyId: company, record: (label: string) => evidence.push(label),
      request: async (who: { id: string }, path: string, body?: unknown, statuses: number[] = [200]) => {
        const url = new URL(path, ORIGIN);
        const handler = handlers[url.pathname];
        if (!handler) throw new Error(`Unmapped route ${url.pathname}`);
        const response = await call(body === undefined ? handler.GET : handler.POST, body === undefined ? "GET" : "POST", url.pathname + url.search, body, who.id);
        expect(statuses, `${url.pathname} answered ${response.status}`).toContain(response.status);
        return response.status === 200 ? await data(response) : undefined;
      },
    });
    expect(evidence).toEqual(expect.arrayContaining(["Exact work revision independently verified", "Private worker Passport contains eligible verified record", "Client-selected Passport owner denied"]));
    // A new session as each party still sees the persisted result; a stranger sees none of it.
    const mine = workListSchema.parse(await data(await call(workRecordsRoute.GET, "GET", "/api/v1/work-records", undefined, worker)));
    expect(mine.items.map(item => item.workId)).toContain(journey.workId);
    expect(passportSchema.parse(await data(await call(passportRoute.GET, "GET", "/api/v1/passport", undefined, worker))).entries.map(entry => entry.workId)).toContain(journey.workId);
    expect(workListSchema.parse(await data(await call(workRecordsRoute.GET, "GET", "/api/v1/work-records", undefined, other))).items).toEqual([]);
    expect((await call(workRecordsRoute.GET, "GET", `/api/v1/work-records?workId=${journey.workId}`, undefined, other)).status).toBe(404);
    expect(passportSchema.parse(await data(await call(passportRoute.GET, "GET", "/api/v1/passport", undefined, other))).entries).toEqual([]);
    expect((await call(agreementsRoute.GET, "GET", `/api/v1/agreements?offerId=${journey.offerId}`, undefined, other)).status).toBe(404);
  }, 120000);

  it("shares one verified record with a named recipient, shows only the chosen fields to that account, and stops on revocation", async () => {
    const passport = passportSchema.parse(await data(await call(passportRoute.GET, "GET", "/api/v1/passport", undefined, worker)));
    const entry = passport.entries.find(item => item.workId === journey.workId)!;
    const itemId = randomUUID(), grantId = randomUUID();
    const post = (body: unknown, who = worker) => call(sharingRoute.POST, "POST", "/api/v1/passport/sharing", body, who);
    const fields = ["task_summary", "verification_status"];
    expect(shareReceipt.parse(await data(await post({ operation: "select", itemId, workId: journey.workId, workVersion: entry.version, summary: "Synthetic shared task summary", fields }))).operation).toBe("select");
    expect((await post({ operation: "select", itemId: randomUUID(), workId: journey.workId, workVersion: entry.version, summary: "Stranger selecting someone else's record", fields }, other)).status).toBeGreaterThanOrEqual(403);
    const expiresAt = new Date(Date.now() + 3 * 86400000).toISOString();
    expect((await post({ operation: "prepare", grantId, itemId, recipientId: other, expiresAt, fields })).status).toBe(200);
    expect((await post({ operation: "activate", grantId })).status).toBe(200);
    const asRecipient = shareProjection.parse(await data(await call(sharingRoute.GET, "GET", `/api/v1/passport/sharing?grantId=${grantId}&mode=recipient`, undefined, other)));
    expect(asRecipient).toMatchObject({ grantId, active: true });
    expect(asRecipient.entries).toHaveLength(1);
    expect(Object.keys(asRecipient.entries[0]!).sort()).toEqual([...fields].sort());
    expect((await call(sharingRoute.GET, "GET", `/api/v1/passport/sharing?grantId=${grantId}&mode=recipient`, undefined, newcomer)).status, "an account that is not the named recipient").toBeGreaterThanOrEqual(403);
    expect((await call(sharingRoute.GET, "GET", `/api/v1/passport/sharing?grantId=${grantId}&mode=recipient`, undefined, representative)).status, "the employer is not the recipient either").toBeGreaterThanOrEqual(403);
    expect(shareList.parse(await data(await call(sharingRoute.GET, "GET", "/api/v1/passport/sharing", undefined, worker))).items).toMatchObject([{ grantId, owner: true, active: true }]);
    expect((await post({ operation: "revoke", grantId }, other)).status, "the recipient cannot revoke").toBeGreaterThanOrEqual(403);
    expect((await post({ operation: "revoke", grantId })).status).toBe(200);
    const after = await call(sharingRoute.GET, "GET", `/api/v1/passport/sharing?grantId=${grantId}&mode=recipient`, undefined, other);
    if (after.status === 200) expect(shareProjection.parse(await data(after))).toMatchObject({ active: false, entries: [] }); else expect(after.status).toBeGreaterThanOrEqual(403);
    expect((await post({ operation: "prepare", grantId: randomUUID(), itemId, recipientId: other, expiresAt, fields: ["task_summary", "task_summary"] })).status, "duplicate fields").toBe(422);
  }, 120000);
  // An open dispute blocks a record from the Passport until it is resolved, so sharing is exercised first.
  it("opens a dispute on the verified record with an extended category, persists it for both parties and hides it from strangers", async () => {
    const work = (await data(await call(workRecordsRoute.GET, "GET", `/api/v1/work-records?workId=${journey.workId}`, undefined, worker))).versions.at(-1);
    const open = (overrides: Record<string, unknown> = {}) => ({ operation: "open", caseId: randomUUID(), idempotencyKey: randomUUID(), workId: journey.workId, expectedVersion: work.version, expectedHash: work.contentHash, expectedEvidenceHash: work.evidenceHash, expectedState: work.state, reasonCode: "incorrect_pay", reason: "Synthetic pay concern raised through the route", ...overrides });
    for (const bad of ["made_up", "INCORRECT_PAY", ""]) expect((await call(casesRoute.POST, "POST", "/api/v1/work-cases", open({ reasonCode: bad }))).status, bad).toBe(422);
    expect((await call(casesRoute.POST, "POST", "/api/v1/work-cases", open({ workerId: other }))).status).toBe(422);
    expect((await call(casesRoute.POST, "POST", "/api/v1/work-cases", open(), other)).status).toBeGreaterThanOrEqual(403);
    const body = open();
    const receipt = await call(casesRoute.POST, "POST", "/api/v1/work-cases", body);
    expect(receipt.status).toBe(200);
    caseReceiptSchema.parse(await data(receipt));
    expect((await call(casesRoute.POST, "POST", "/api/v1/work-cases", body)).status, "an exact retry replays").toBe(200);
    expect((await call(casesRoute.POST, "POST", "/api/v1/work-cases", open())).status, "a second concurrent case on the same record").toBeGreaterThanOrEqual(409);
    const view = caseReadSchema.parse(await data(await call(casesRoute.GET, "GET", `/api/v1/work-cases?caseId=${body.caseId}`)));
    expect(view).toMatchObject({ caseId: body.caseId, status: "open", reasonCode: "incorrect_pay" });
    expect(caseListSchema.parse(await data(await call(casesRoute.GET, "GET", "/api/v1/work-cases"))).items.map(item => item.caseId)).toContain(body.caseId);
    expect((await call(casesRoute.GET, "GET", `/api/v1/work-cases?caseId=${body.caseId}`, undefined, other)).status).toBe(404);
    expect(caseListSchema.parse(await data(await call(casesRoute.GET, "GET", "/api/v1/work-cases", undefined, other))).items).toEqual([]);
  }, 120000);

});

describe("administration, audit and export through the real routes", () => {
  const adminRead = (who: string | null) => call(adminRoute.GET, "GET", "/api/v1/admin?resource=audit&from=2026-10-01&to=2026-10-31", undefined, who);
  it("refuses everyone but an administrator on the console, the chain verifier and the export log", async () => {
    expect((await adminRead(null)).status).toBe(401);
    for (const who of [worker, representative, other]) {
      expect((await adminRead(who)).status, "console").toBe(403);
      expect((await call(auditChainRoute.GET, "GET", "/api/v1/admin/audit-chain", undefined, who)).status, "verifier").toBe(403);
      expect((await call(exportLogRoute.POST, "POST", "/api/v1/admin/export-log", { exportId: randomUUID(), resource: "audit", count: 1, complete: true, checksum: "a".repeat(64), filterNames: [] }, who)).status, "export log").toBe(403);
    }
    expect((await adminRead(admin)).status).toBe(200);
  });
  it("verifies the audit chain, which grows by exactly one link when an account changes its profile, and records an export once", async () => {
    const verify = async () => auditChainResult.parse(await data(await call(auditChainRoute.GET, "GET", "/api/v1/admin/audit-chain", undefined, admin)));
    const before = await verify();
    expect(before).toMatchObject({ ok: true, brokenLinks: 0, alteredOrDeletedRecords: 0, recordsNotInChain: 0 });
    const me = meSchema.parse(await data(await call(meRoute.GET, "GET", "/api/v1/me", undefined, other)));
    expect((await call(meRoute.PATCH, "PATCH", "/api/v1/me", { displayName: "Audited rename", locale: "en", timeZone: "UTC", expectedRevision: me.revision }, other, { "idempotency-key": randomUUID() })).status).toBe(200);
    const after = await verify();
    expect(after.ok).toBe(true);
    expect(after.checked).toBe(before.checked + 1);
    expect(after.head).not.toBe(before.head);
    const body = { exportId: randomUUID(), resource: "audit", count: 3, complete: true, checksum: "b".repeat(64), filterNames: ["resource", "from"] };
    expect((await data(await call(exportLogRoute.POST, "POST", "/api/v1/admin/export-log", body, admin)))).toEqual({ exportId: body.exportId, recorded: true, replayed: false });
    expect((await data(await call(exportLogRoute.POST, "POST", "/api/v1/admin/export-log", body, admin))).replayed).toBe(true);
    expect((await call(exportLogRoute.POST, "POST", "/api/v1/admin/export-log", { ...body, exportId: randomUUID(), checksum: "xyz" }, admin)).status).toBe(422);
    expect((await call(exportLogRoute.POST, "POST", "/api/v1/admin/export-log", { ...body, exportId: randomUUID(), records: [{ secret: 1 }] }, admin)).status).toBe(422);
    expect((await verify()).checked, "the export entry is chained as well").toBeGreaterThan(after.checked);
  });
});
