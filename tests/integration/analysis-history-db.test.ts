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
const hash = "a".repeat(64);
const resultFor = (score: number) => ({ version: "offer-indicators.v1", score, meaning: "Synthetic", limitations: "Synthetic", employerVerification: "not_assessed", statedCount: 1, missingCount: 2, uncertainCount: 3, concernCount: 4, categories: [], items: [] });
async function current(actor = worker) { const offerRead = (await rpc("get_agreement", { offerId: offer }, actor)).offer as { version: number; termHash: string }; return offerRead; }
const save = (o: { version: number; termHash: string }, score = 55, key = randomUUID()) => ({ operation: "save", offerId: offer, offerVersion: o.version, termHash: o.termHash, engine: "offer-indicators.v1", score, result: resultFor(score), idempotencyKey: key });
it("saves an immutable snapshot bound to the live offer, deduplicates retries and lists newest first", async () => {
  const o = await current(); const request = save(o, 55);
  const first = await rpc("analysis_history", request);
  expect(first).toMatchObject({ saved: true }); expect(await rpc("analysis_history", request)).toEqual(first);
  await expect(rpc("analysis_history", { ...request, score: 56, result: resultFor(56) })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  await rpc("analysis_history", save(o, 60));
  const listed = await rpc("analysis_history", { operation: "list", offerId: offer });
  expect((listed.items as { score: number; offerVersion: number }[]).map(i => i.score)).toEqual([60, 55]);
  expect(listed.items).toMatchObject([{ offerVersion: o.version, termHash: o.termHash }, { offerVersion: o.version }]);
  await expect(db.exec("update private.analysis_history set score=1")).rejects.toThrow("ACTION_FORBIDDEN");
  await expect(db.exec("delete from private.analysis_history")).rejects.toThrow("ACTION_FORBIDDEN");
});
it("refuses snapshots that do not describe the current terms or are malformed", async () => {
  const o = await current();
  await expect(rpc("analysis_history", save({ ...o, termHash: hash }))).rejects.toThrow("VERSION_CONFLICT");
  await expect(rpc("analysis_history", save({ ...o, version: o.version + 5 }))).rejects.toThrow("VERSION_CONFLICT");
  for (const bad of [{ ...save(o), score: 101 }, { ...save(o), result: { ...resultFor(55), score: 54 } }, { ...save(o), engine: "other" }, { ...save(o), extra: 1 }, { ...save(o), termHash: "xyz" }, { ...save(o), result: "text" }])
    await expect(rpc("analysis_history", bad)).rejects.toThrow("VALIDATION_FAILED");
});
it("isolates users: unrelated accounts cannot save or read, and history never leaks across accounts", async () => {
  const o = await current();
  await expect(rpc("analysis_history", save(o), other)).rejects.toThrow();
  await expect(rpc("analysis_history", { operation: "list", offerId: offer }, other)).rejects.toThrow();
  const repView = await rpc("analysis_history", save(o, 70), representative);
  expect(repView).toMatchObject({ saved: true });
  const workerList = (await rpc("analysis_history", { operation: "list", offerId: offer })).items as { score: number }[];
  expect(workerList.map(i => i.score)).not.toContain(70);
  const repList = (await rpc("analysis_history", { operation: "list", offerId: offer }, representative)).items as { score: number }[];
  expect(repList.map(i => i.score)).toEqual([70]);
  const access = await db.query("select relrowsecurity,relforcerowsecurity,has_table_privilege('authenticated',oid,'SELECT') r from pg_class where oid='private.analysis_history'::regclass");
  expect(access.rows[0]).toEqual({ relrowsecurity: true, relforcerowsecurity: true, r: false });
});
