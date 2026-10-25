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
const team = (companyId: string, actor: typeof worker) => rpc("company_team", { companyId }, actor);
it("shows an approved representative only membership facts for their own organization", async () => {
  const result = await team(company, representative);
  expect(Object.keys(result).sort()).toEqual(["changeProcess", "companyId", "members"]);
  expect(result).toMatchObject({ companyId: company, changeProcess: "operator_reviewed" });
  const members = result.members as Record<string, unknown>[];
  expect(members).toHaveLength(1);
  expect(Object.keys(members[0]!).sort()).toEqual(["effectiveAt", "expiresAt", "role", "self", "status"]);
  expect(members[0]).toMatchObject({ self: true, role: "representative", status: "active" });
  expect(JSON.stringify(result)).not.toContain(representative);
});
it("answers identically for unknown organizations and for callers without authority", async () => {
  const unknown = randomUUID();
  const denials: string[] = [];
  for (const [id, actor] of [[company, worker], [company, other], [company, operator], [unknown, representative]] as const) {
    try { await team(id, actor); denials.push("ALLOWED"); } catch (error) { denials.push((error as Error).message); }
  }
  expect(denials).toEqual(["NOT_FOUND", "NOT_FOUND", "NOT_FOUND", "NOT_FOUND"]);
});
it("rejects malformed requests and is not callable anonymously or writable by clients", async () => {
  for (const request of [{}, { companyId: null }, { companyId: "x" }, { companyId: company, actorId: worker }, [company]]) await expect(rpc("company_team", request, representative)).rejects.toThrow("VALIDATION_FAILED");
  const grants = await db.query<{ a: boolean; u: boolean }>("select has_function_privilege('anon','api.company_team(jsonb)','EXECUTE') a, has_function_privilege('authenticated','api.company_team(jsonb)','EXECUTE') u");
  expect(grants.rows[0]).toEqual({ a: false, u: true });
  const helper = await db.query<{ u: boolean }>("select has_function_privilege('authenticated','private.company_team(uuid)','EXECUTE') u");
  expect(helper.rows[0]).toEqual({ u: false });
});
