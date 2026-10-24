import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { opportunityPage } from "../../src/features/opportunities/schema";
import { guidancePage } from "../../src/features/guidance/schema";
const db = new PGlite();
const operator = randomUUID(), representative = randomUUID(), worker = randomUUID(), other = randomUUID();
let company: string;
const listing = randomUUID();
const guidanceThread = randomUUID(), offer = randomUUID();
const fields = { title: "Synthetic warehouse role", description: "Synthetic fixture only, not a real vacancy.", location: "Colombo", workMode: "onsite", salary: 50000, currency: "LKR", payPeriod: "month" };
const preferences = { role: "warehouse", location: "Colombo", workMode: "onsite", minimumPay: 40000, currency: "LKR", payPeriod: "month" };
async function rpc(name: string, request: unknown, actor = worker) {
  await db.exec("begin; set local role authenticated");
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: actor, role: "authenticated", aal: "aal2", is_anonymous: false })]);
    const result = await db.query<{ data: unknown }>(`select api.${name}($1::jsonb) data`, [JSON.stringify(request)]);
    await db.exec("commit"); return result.rows[0]!.data;
  } catch (error) { await db.exec("rollback"); throw error; }
}
const read = (view = "discover", cursor: string | null = null) => rpc("opportunity_read", { view, query: "", cursor }).then(raw => opportunityPage.parse(raw));
const save = (status = "draft", version = 0) => ({ operation: "listing", id: listing, companyId: company, fields, status, expectedVersion: version, expiresAt: new Date(Date.now() + 86400000).toISOString(), idempotencyKey: randomUUID() });
beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;");
  for (const file of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  for (const id of [operator, representative, worker, other]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into private.profiles(id,display_name) values($1,'Synthetic fixture')", [id]);
  }
  await db.query("insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at) values($1,'authority_operator',$2,'Synthetic test only',now()+interval '1 day')", [operator, other]);
  company = (await rpc("provision_company", { name: "Synthetic opportunities company", idempotencyKey: randomUUID() }, operator) as { id: string }).id;
  await rpc("decide_membership", { companyId: company, subjectId: representative, decision: "approve", expectedRevision: 0, expiresAt: new Date(Date.now() + 86400000).toISOString(), reviewedEvidenceRefs: ["demo:fixture/opportunities"], reason: "Synthetic rehearsal", policyVersion: "demo-authority.v1", idempotencyKey: randomUUID() }, operator);
}, 120000);
afterAll(() => db.close());
it("denies unauthorized publication and caller-selected identity", async () => {
  await expect(rpc("opportunity_command", save("published"))).rejects.toThrow("ACTION_FORBIDDEN");
  await expect(rpc("opportunity_command", { ...save(), actorId: representative }, representative)).rejects.toThrow("VALIDATION_FAILED");
});
it("keeps drafts private and publishes only on explicit command", async () => {
  const command = save();
  expect(await rpc("opportunity_command", command, representative)).toEqual({ saved: true });
  expect(await rpc("opportunity_command", command, representative)).toEqual({ saved: true });
  expect((await read()).items).toHaveLength(0);
  await rpc("opportunity_command", save("published", 1), representative);
  expect((await read()).items[0]).toMatchObject({ id: listing, version: 2, source: "representative_submission", assurance: "demo_provisioned", canEdit: false });
});
it("rejects stale updates, malformed SQL input and changed retries", async () => {
  await expect(rpc("opportunity_command", save("published", 1), representative)).rejects.toThrow("VERSION_CONFLICT");
  await expect(rpc("opportunity_command", { ...save("published", 2), fields: { ...fields, salary: -1 } }, representative)).rejects.toThrow("VALIDATION_FAILED");
  await expect(rpc("opportunity_command", { ...save("published", 2), fields: { ...fields, workMode: null } }, representative)).rejects.toThrow("VALIDATION_FAILED");
  const command = { operation: "choice", id: listing, choice: "saved", idempotencyKey: randomUUID() };
  await rpc("opportunity_command", command);
  await expect(rpc("opportunity_command", { ...command, choice: "hidden" })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
});
it("persists private preferences and feedback without disclosure to employers", async () => {
  await rpc("opportunity_command", { operation: "preferences", preferences, expectedVersion: 0, idempotencyKey: randomUUID() });
  expect((await read()).preferences).toEqual(preferences);
  expect((await read("saved")).items).toHaveLength(1);
  const employer = opportunityPage.parse(await rpc("opportunity_read", { view: "discover", query: "", cursor: null }, representative));
  expect(employer.preferences).toBeNull(); expect(employer.items[0]?.choice).toBe("none");
  await rpc("opportunity_command", { operation: "choice", id: listing, choice: "hidden", idempotencyKey: randomUUID() });
  expect((await read()).items).toHaveLength(0);
  expect((await read("hidden")).items[0]?.choice).toBe("hidden");
  await rpc("opportunity_command", { operation: "choice", id: listing, choice: "none", idempotencyKey: randomUUID() });
});
it("hides expired and closed listings", async () => {
  await rpc("opportunity_command", save("closed", 2), representative);
  expect((await read()).items).toHaveLength(0);
  await rpc("opportunity_command", save("published", 3), representative);
  await db.query("update private.opportunity_listings set expires_at=now()-interval '1 second' where id=$1", [listing]);
  expect((await read()).items).toHaveLength(0);
  await db.query("update private.opportunity_listings set expires_at=now()+interval '1 day' where id=$1", [listing]);
});
it("enforces RLS, private table grants and immutable events", async () => {
  const check = await db.query("select has_table_privilege('authenticated','private.opportunity_listings','SELECT') allowed, rolbypassrls from pg_roles where rolname='fw_user_exec'");
  expect(check.rows[0]).toEqual({ allowed: false, rolbypassrls: false });
  await expect(db.exec("update private.opportunity_events set request='{}'")).rejects.toThrow();
  await expect(rpc("opportunity_read", { view: "discover", query: "", cursor: null, actorId: worker })).rejects.toThrow("VALIDATION_FAILED");
});
it("persists private guidance without trusting caller-supplied answers or sharing threads", async () => {
  const command = { operation: "send", threadId: guidanceThread, question: "How do I preserve evidence?", topic: "evidence", offerId: null, idempotencyKey: randomUUID() };
  const first = guidancePage.parse(await rpc("guidance", command));
  expect(first.turns[0]?.response).toMatchObject({ mode: "rules", sourceVersion: "guidance.v1" });
  expect(guidancePage.parse(await rpc("guidance", command)).turns).toHaveLength(1);
  expect(guidancePage.parse(await rpc("guidance", { operation: "read", threadId: guidanceThread }, other)).turns).toHaveLength(0);
  await expect(rpc("guidance", { ...command, response: "Verified" })).rejects.toThrow("VALIDATION_FAILED");
  await expect(rpc("guidance", { ...command, question: "Changed retry" })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  await expect(db.exec("delete from private.guidance_turns")).rejects.toThrow();
});
it("grounds optional offer context through the existing participant RPC", async () => {
  await rpc("review_offer", { offerId: offer, companyId: company, workerId: worker, requesterRole: "EMPLOYER", terms: { role: "Synthetic role", salary: 100, currency: "LKR", hoursPerWeek: 40, responsibilities: "Synthetic work", startDate: "2026-11-01" }, expectedVersion: 1, idempotencyKey: randomUUID() }, representative);
  const command = { operation: "send", threadId: guidanceThread, question: "Which revision am I reviewing?", topic: "offer", offerId: offer, idempotencyKey: randomUUID() };
  const result = guidancePage.parse(await rpc("guidance", command, representative));
  expect(result.turns[0]?.response.context).toMatchObject({ offerId: offer, version: 1 });
  await expect(rpc("guidance", { ...command, idempotencyKey: randomUUID() }, other)).rejects.toThrow();
});
it("revoked publisher authority suppresses discovery and idempotent retries", async () => {
  const command = save("published", 4);
  await rpc("opportunity_command", command, representative);
  await rpc("decide_membership", { companyId: company, subjectId: representative, decision: "revoke", expectedRevision: 1, expiresAt: null, reviewedEvidenceRefs: ["demo:fixture/opportunities"], reason: "Synthetic revocation", policyVersion: "demo-authority.v1", idempotencyKey: randomUUID() }, operator);
  expect((await read()).items).toHaveLength(0);
  await expect(rpc("opportunity_command", command, representative)).rejects.toThrow("ACTION_FORBIDDEN");
  await expect(rpc("guidance", { operation: "read", threadId: guidanceThread }, representative)).rejects.toThrow();
});
it("paginates visible listings without duplicates and keeps restricted profiles out", async () => {
  // Fixture bootstrap uses the disposable database only, never hosted data.
  await rpc("decide_membership", { companyId: company, subjectId: representative, decision: "approve", expectedRevision: 2, expiresAt: new Date(Date.now() + 86400000).toISOString(), reviewedEvidenceRefs: ["demo:fixture/opportunities"], reason: "Synthetic reapproval", policyVersion: "demo-authority.v1", idempotencyKey: randomUUID() }, operator);
  await db.query("insert into private.opportunity_listings select gen_random_uuid(),company_id,author_id,1,fields,status,expires_at,updated_at from private.opportunity_listings cross join generate_series(1,22) where id=$1", [listing]);
  const first = await read(); expect(first.items).toHaveLength(20); expect(first.nextCursor).not.toBeNull();
  const second = await read("discover", first.nextCursor); expect(second.items).toHaveLength(3);
  expect(new Set([...first.items, ...second.items].map(item => item.id)).size).toBe(23);
  await db.query("update private.profiles set account_state='suspended' where id=$1", [other]);
  await expect(rpc("opportunity_read", { view: "discover", query: "", cursor: null }, other)).rejects.toThrow();
});
