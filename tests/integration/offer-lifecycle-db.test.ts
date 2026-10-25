import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
const db = new PGlite();
const operator = randomUUID(), representative = randomUUID(), worker = randomUUID(), other = randomUUID(), offer = randomUUID();
let company: string;
async function rpc(name: string, request: unknown, actor = worker) {
  await db.exec("begin; set local role authenticated");
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: actor, role: "authenticated", aal: "aal2", is_anonymous: false })]);
    const result = await db.query<{ data: Record<string, unknown> }>(`select api.${name}($1::jsonb) data`, [JSON.stringify(request)]);
    await db.exec("commit"); return result.rows[0]!.data;
  } catch (error) { await db.exec("rollback"); throw error; }
}
const list = (actor = worker, view = "active") => rpc("list_offers", { context: actor === representative ? "EMPLOYER" : "WORKER", cursor: null, view }, actor);
const command = (expectedRevision = 0, archived = true) => ({ offerId: offer, archived, decision: "interested", expectedRevision, idempotencyKey: randomUUID() });
beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;");
  for (const file of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  for (const id of [operator, representative, worker, other]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into private.profiles(id,display_name) values($1,'Synthetic fixture')", [id]);
  }
  await db.query("insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at) values($1,'authority_operator',$2,'Synthetic test only',now()+interval '1 day')", [operator, other]);
  company = (await rpc("provision_company", { name: "Synthetic lifecycle company", idempotencyKey: randomUUID() }, operator)).id as string;
  await rpc("decide_membership", { companyId: company, subjectId: representative, decision: "approve", expectedRevision: 0, expiresAt: new Date(Date.now() + 86400000).toISOString(), reviewedEvidenceRefs: ["demo:fixture/lifecycle"], reason: "Synthetic rehearsal", policyVersion: "demo-authority.v1", idempotencyKey: randomUUID() }, operator);
  await rpc("review_offer", { offerId: offer, companyId: company, workerId: worker, requesterRole: "EMPLOYER", terms: { role: "Synthetic role", salary: 100, currency: "LKR", hoursPerWeek: 40, responsibilities: "Synthetic work", startDate: "2026-11-01" }, expectedVersion: 1, idempotencyKey: randomUUID() }, representative);
}, 120000);
afterAll(() => db.close());
it("archives privately, persists decisions and restores without changing agreement", async () => {
  const before = await rpc("get_agreement", { offerId: offer });
  const change = command();
  expect(await rpc("offer_lifecycle", change)).toEqual({ saved: true, revision: 1 });
  expect(await rpc("offer_lifecycle", change)).toEqual({ saved: true, revision: 1 });
  expect((await list()).items).toEqual([]);
  expect((await list(worker, "archived")).items).toMatchObject([{ offerId: offer, archived: true, decision: "interested", lifecycleRevision: 1 }]);
  expect((await list(representative)).items).toMatchObject([{ offerId: offer, archived: false, decision: "considering", lifecycleRevision: 0 }]);
  expect(await rpc("get_agreement", { offerId: offer })).toEqual(before);
  await expect(rpc("offer_lifecycle", { ...change, decision: "declined" })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  await expect(rpc("offer_lifecycle", command())).rejects.toThrow("VERSION_CONFLICT");
  await rpc("offer_lifecycle", command(1, false));
  expect((await list()).items).toMatchObject([{ archived: false, lifecycleRevision: 2 }]);
});
it("denies unrelated access, actor injection and malformed direct RPC input", async () => {
  await expect(rpc("offer_lifecycle", command(), other)).rejects.toThrow();
  expect((await list(other, "all")).items).toEqual([]);
  for (const change of [{ ...command(), actorId: worker }, { ...command(), archived: "true" }, { ...command(), expectedRevision: null }, { ...command(), decision: "verified" }]) await expect(rpc("offer_lifecycle", change)).rejects.toThrow("VALIDATION_FAILED");
});
it("forces private RLS and immutable audit records", async () => {
  const result = await db.query("select relrowsecurity,relforcerowsecurity,has_table_privilege('authenticated',oid,'SELECT') readable from pg_class where oid='private.offer_lifecycle_events'::regclass");
  expect(result.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true, readable: false });
  await expect(db.exec("delete from private.offer_lifecycle_events")).rejects.toThrow();
});
it("revoked representatives cannot retry or see lifecycle records", async () => {
  const change = command(); await rpc("offer_lifecycle", change, representative);
  await rpc("decide_membership", { companyId: company, subjectId: representative, decision: "revoke", expectedRevision: 1, expiresAt: null, reviewedEvidenceRefs: ["demo:fixture/lifecycle"], reason: "Synthetic revocation", policyVersion: "demo-authority.v1", idempotencyKey: randomUUID() }, operator);
  await expect(rpc("offer_lifecycle", change, representative)).rejects.toThrow();
  expect((await list(representative, "all")).items).toEqual([]);
});
it("legacy callers without a view keep the original response shape and still see every offer", async () => {
  const current = (await list(worker, "all")).items as { lifecycleRevision: number }[];
  await rpc("offer_lifecycle", { offerId: offer, archived: true, decision: "declined", expectedRevision: current[0]!.lifecycleRevision, idempotencyKey: randomUUID() });
  expect((await list()).items).toEqual([]);
  const legacy = await rpc("list_offers", { context: "WORKER", cursor: null });
  const items = legacy.items as Record<string, unknown>[];
  expect(items).toHaveLength(1);
  expect(Object.keys(items[0]!).sort()).toEqual(["companyId", "createdAt", "offerId", "questions", "role", "version"]);
  expect(Object.keys(legacy).sort()).toEqual(["items", "nextCursor"]);
  expect(Object.keys(((await list(worker, "all")).items as object[])[0]!).sort()).toEqual(["archived", "companyId", "createdAt", "decision", "lifecycleRevision", "offerId", "questions", "role", "version"]);
});
