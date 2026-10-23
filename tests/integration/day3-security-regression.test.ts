import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { answerOfferQuestionSchema, manualOfferRequestSchema } from "@/features/offer/schema";
import { agreementReadSchema } from "@/features/offer/read-schema";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const db = new PGlite();
afterAll(() => db.close());
const WORKER = "40000000-0000-4000-8000-000000000012";
const APPROVER = "40000000-0000-4000-8000-000000000013";
const MEMBER = "40000000-0000-4000-8000-000000000014";
const OTHER = "40000000-0000-4000-8000-000000000015";
let COMPANY: string;

function claims(id: string, aal = "aal2") {
  return { sub: id, role: "authenticated", aal, is_anonymous: false };
}

async function run<T = Record<string, unknown>>(sql: string, params: unknown[] = [], jwt = claims(APPROVER), role = "authenticated") {
  await db.exec(`begin; set local role ${role}`);
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(jwt)]);
    const result = await db.query<T>(sql, params);
    await db.exec("commit");
    return result.rows;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

async function runMigration(sql: string) {
  const statements: string[] = [];
  let start = 0;
  let quote: "'" | '"' | null = null;
  let dollarTag: string | null = null;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < sql.length; index += 1) {
    if (lineComment) {
      if (sql[index] === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (sql.startsWith("*/", index)) {
        index += 1;
        blockComment = false;
      }
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }
    const char = sql[index]!;
    if (quote) {
      if (char === quote && sql[index + 1] === quote) {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (sql.startsWith("--", index)) {
      lineComment = true;
      index += 1;
      continue;
    }
    if (sql.startsWith("/*", index)) {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "$") {
      const tag = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z_0-9]*\$|^\$\$/)?.[0];
      if (tag) {
        dollarTag = tag;
        index += tag.length - 1;
        continue;
      }
    }
    if (char === ";") {
      const statement = sql.slice(start, index + 1).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }
  const trailing = sql.slice(start).trim();
  if (trailing) statements.push(trailing);
  for (const [index, statement] of statements.entries()) {
    try {
      await db.exec(statement);
    } catch (error) {
      throw new Error(`Day 3 migration statement ${index + 1} failed: ${statement.slice(0, 180)}`, { cause: error });
    }
  }
}

beforeAll(async () => {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;`);
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);`);
  await db.exec(`create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;`);
  await db.exec(`create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;`);
  await db.exec(`grant usage on schema auth to anon, authenticated, service_role;`);

  await db.exec(await readFile("supabase/migrations/202610070001_identity_foundation.sql", "utf8"));
  await db.exec("revoke usage on schema auth from fw_user_exec, fw_policy_exec");
  await db.exec(await readFile("supabase/migrations/202610080002_identity_auth_context.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/202610090001_identity_rpc_execute.sql", "utf8"));
  for (const id of [WORKER, APPROVER, MEMBER, OTHER]) {
    await db.exec(`insert into auth.users values('${id}')`);
    await run("select api.create_profile($1::jsonb)", [
      JSON.stringify({ displayName: `Synthetic ${id}`, locale: "en", timeZone: "UTC", idempotencyKey: crypto.randomUUID() }),
    ], claims(id));
  }
  await db.exec(`create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key);
    insert into supabase_migrations.schema_migrations values ('202610070001'),('202610080002'),('202610090001');
    insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at)
    values('${APPROVER}','authority_operator','${MEMBER}','Local synthetic Day 3 fixture',now()+interval '1 day'),
          ('${MEMBER}','authority_operator','${APPROVER}','Local synthetic Day 3 fixture',now()+interval '1 day');
    revoke usage on schema auth from fw_user_exec,fw_policy_exec;
    create role fixture_root superuser;
    create role managed_auth_owner nologin;
    alter schema auth owner to managed_auth_owner;
    grant usage on schema auth to postgres;
    set session authorization fixture_root;
    alter role postgres rename to fixture_bootstrap;
    create role postgres login inherit nosuperuser nobypassrls createrole;
    grant fw_schema_owner,fw_user_exec,fw_policy_exec to postgres;
    grant usage on schema auth to postgres;
    grant usage, create on schema private to postgres;
    alter function private.request_uid() owner to postgres;
    alter function private.request_jwt() owner to postgres;
    grant create on schema private to postgres;
    grant usage on schema supabase_migrations to postgres;
    grant select on supabase_migrations.schema_migrations to postgres;
    set role postgres;`);
  try {
    await db.exec(await readFile("supabase/migrations/202610090002_demo_authority.sql", "utf8"));
  } finally {
    await db.exec("reset role");
  }
  await db.exec("insert into supabase_migrations.schema_migrations values('202610090002')");

  const provision = await run(`select api.provision_company($1::jsonb) as value`, [
    JSON.stringify({ name: "Synthetic Day 3 company", idempotencyKey: crypto.randomUUID() }),
  ], claims(MEMBER));
  COMPANY = String((provision[0] as { value: { id: string } }).value.id);
  const approve = async (subjectId: string, actorId: string) => run(`select api.decide_membership($1::jsonb) as value`, [
    JSON.stringify({
      companyId: COMPANY,
      subjectId,
      decision: "approve",
      expectedRevision: 0,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      reviewedEvidenceRefs: ["demo:fixture/representative"],
      reason: "Synthetic Day 3 test authority",
      policyVersion: "demo-authority.v1",
      idempotencyKey: crypto.randomUUID(),
    }),
  ], claims(actorId));
  await approve(APPROVER, MEMBER);
  await approve(WORKER, APPROVER);
  await approve(MEMBER, APPROVER);
  await bootstrapAudit();

  await db.exec("set role postgres");
  const preflight = await db.exec(await readFile("scripts/day3-hosted-preflight.sql", "utf8"));
  const preflightResults = preflight.find((result) => result.command === "SELECT");
  expect(preflightResults?.rows).toHaveLength(10);
  expect(preflightResults?.rows.map((row) => row.result)).toEqual(Array(10).fill("PASS"));
  const migrationPrivileges = await db.query<{ role: string; schemaUsage: boolean; schemaCreate: boolean }>(
    "select current_user as role, has_schema_privilege(current_user, 'private', 'USAGE') as schemaUsage, has_schema_privilege(current_user, 'private', 'CREATE') as schemaCreate",
  );
  expect(migrationPrivileges.rows).toEqual([{ role: "postgres", schemausage: true, schemacreate: true }]);
  try {
    await runMigration(await readFile("supabase/migrations/202610100001_day3_offer_agreement.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/202610120001_agreement_participant_read.sql", "utf8"));
  } catch (error) {
    await db.exec("rollback").catch(() => undefined);
    throw error;
  } finally {
    await db.exec("reset role");
  }
  await db.exec("revoke create on schema private from postgres");
  await db.exec("insert into supabase_migrations.schema_migrations values('202610100001')");
  await db.exec("insert into supabase_migrations.schema_migrations values('202610120001')");
});


async function bootstrapAudit() {
  await db.query("insert into private.audit_logs(actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class) values($1,'bootstrap_capability',$1,$2,array['capability'],'offline_capability_bootstrap','authority')", [APPROVER, crypto.randomUUID()]);
}
const terms = { salary: 120000, currency: "USD", startDate: "2027-01-15", hoursPerWeek: 40, responsibilities: "Ship the MVP." };
async function review(overrides: Record<string, unknown> = {}, actor = APPROVER) {
  const payload = { offerId: crypto.randomUUID(), companyId: COMPANY, workerId: WORKER, requesterRole: "EMPLOYER", terms, expectedVersion: 1, idempotencyKey: crypto.randomUUID(), ...overrides };
  const rows = await run<{ value: typeof payload & { snapshot: typeof terms; unresolved: Array<{ id: string }> } }>("select api.review_offer($1::jsonb) as value", [payload], claims(actor));
  return { payload, result: rows[0]!.value };
}
function confirmation(offerId: string, overrides: Record<string, unknown> = {}) {
  return { agreementId: crypto.randomUUID(), offerId, companyId: COMPANY, workerId: WORKER, confirmationRole: "EMPLOYER", expectedVersion: 1, idempotencyKey: crypto.randomUUID(), ...overrides };
}
describe("Day 3 scan security regressions", () => {
  it("restores both independent participants with one shared agreement ID and persisted confirmations", async () => {
    const { payload } = await review();
    const read = async (actor: string) => agreementReadSchema.parse((await run<{ value: unknown }>("select api.get_agreement($1::jsonb) as value", [{ offerId: payload.offerId }], claims(actor)))[0]!.value);
    const employer = await read(APPROVER);
    const worker = await read(WORKER);
    expect(worker.offer.snapshot).toEqual(terms);
    expect(worker.agreementId).toBe(employer.agreementId);
    expect(worker.canConfirm).toBe(true);
    const command = confirmation(payload.offerId, { agreementId: worker.agreementId });
    await run("select api.confirm_agreement($1::jsonb)", [command]);
    expect((await read(APPROVER)).confirmation?.status).toBe("awaiting_other_party");
    expect((await read(WORKER)).confirmation).toBeNull();
    await run("select api.confirm_agreement($1::jsonb)", [{ ...command, confirmationRole: "WORKER", idempotencyKey: crypto.randomUUID() }], claims(WORKER));
    expect((await read(APPROVER)).confirmation?.status).toBe("confirmed");
    expect((await read(WORKER)).canConfirm).toBe(false);
    await review({ offerId: payload.offerId, expectedVersion: 2, terms: { ...terms, salary: 130000 } });
    const revised = await read(WORKER);
    expect(revised.offer.version).toBe(2);
    expect(revised.agreementId).not.toBe(worker.agreementId);
    expect(revised.confirmation).toBeNull();
  });
  it("returns identical not-found errors for missing and unauthorized read IDs", async () => {
    const { payload } = await review();
    for (const actor of [OTHER, MEMBER]) {
      for (const offerId of [payload.offerId, crypto.randomUUID()]) {
        await expect(run("select api.get_agreement($1::jsonb)", [{ offerId }], claims(actor))).rejects.toMatchObject({ message: "NOT_FOUND" });
      }
    }
    await expect(run("select api.get_agreement($1::jsonb)", [{ offerId: payload.offerId, workerId: WORKER }])).rejects.toMatchObject({ message: "VALIDATION_FAILED" });
    await expect(run("select api.get_agreement($1::jsonb)", [{ offerId: "not-a-uuid" }])).rejects.toMatchObject({ message: "VALIDATION_FAILED" });
    for (const role of ["anon", "service_role"]) {
      await expect(run("select api.get_agreement($1::jsonb)", [{ offerId: payload.offerId }], claims(WORKER), role)).rejects.toMatchObject({ code: "42501" });
    }
    const catalog = await db.exec(await readFile("scripts/agreement-read-catalog.sql", "utf8"));
    const rows = catalog.find((result) => result.command === "SELECT")!.rows;
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.result === "PASS")).toBe(true);
    const originalCatalog = await db.exec(await readFile("scripts/day3-hosted-catalog.sql", "utf8"));
    const originalRows = originalCatalog.find((result) => result.command === "SELECT")!.rows;
    expect(originalRows).toHaveLength(12);
    expect(originalRows.every((row) => row.result === "PASS")).toBe(true);
  });
  it("restores attributed clarification answers without leaking private drafts", async () => {
    const { payload, result } = await review({ terms: {} });
    const questionId = result.unresolved[0]!.id;
    await run("select api.answer_offer_question($1::jsonb)", [{ offerId: payload.offerId, offerVersion: 1, questionId, answer: "Discuss with the representative", idempotencyKey: crypto.randomUUID() }], claims(WORKER));
    const saved = agreementReadSchema.parse((await run<{ value: unknown }>("select api.get_agreement($1::jsonb) as value", [{ offerId: payload.offerId }]))[0]!.value);
    expect(saved.answers).toEqual([{ questionId, answer: "Discuss with the representative", answeredBy: WORKER }]);
    expect(saved.canConfirm).toBe(false);
    const draft = await review({ requesterRole: "WORKER" }, WORKER);
    await expect(run("select api.get_agreement($1::jsonb)", [{ offerId: draft.payload.offerId }])).rejects.toMatchObject({ message: "NOT_FOUND" });
  });
  it("retains offline bootstrap audit compatibility after Day 3", async () => {
    await bootstrapAudit();
  });
  it("returns the persisted snapshot on initial review and idempotent replay", async () => {
    const { payload, result } = await review();
    expect(result.snapshot).toEqual(terms);
    const replay = await run("select api.review_offer($1::jsonb) as value", [payload]);
    expect(replay[0]).toMatchObject({ value: { snapshot: terms, idempotent: true } });
  });
  it("emits deterministic question UUIDs accepted by the actual answer request schema", async () => {
    const { payload, result } = await review({ terms: {} });
    expect(manualOfferRequestSchema.safeParse(payload).success).toBe(true);
    expect(result.unresolved).toHaveLength(5);
    for (const question of result.unresolved) {
      const answer = { offerId: payload.offerId, offerVersion: 1, questionId: question.id, answer: "Still under discussion", idempotencyKey: crypto.randomUUID() };
      expect(answerOfferQuestionSchema.safeParse(answer).success).toBe(true);
      await run("select api.answer_offer_question($1::jsonb)", [answer], claims(WORKER));
    }
    const replay = await run("select api.review_offer($1::jsonb) as value", [payload]);
    expect(replay[0]).toMatchObject({ value: { unresolved: result.unresolved } });
  });
  it("rejects cross-version answers and never restores earlier answers into an amendment", async () => {
    const { payload, result } = await review({ terms: {} });
    const answer = { offerId: payload.offerId, offerVersion: 1, questionId: result.unresolved[0]!.id,
      answer: "Still under discussion", idempotencyKey: crypto.randomUUID() };
    await run("select api.answer_offer_question($1::jsonb)", [answer], claims(WORKER));
    await review({ offerId: payload.offerId, expectedVersion: 2, terms: {} });
    await expect(run("select api.answer_offer_question($1::jsonb)", [answer], claims(WORKER)))
      .rejects.toMatchObject({ message: "VERSION_CONFLICT" });
    await expect(run("select api.answer_offer_question($1::jsonb)", [{ ...answer, offerVersion: 2, idempotencyKey: crypto.randomUUID() }], claims(WORKER)))
      .rejects.toMatchObject({ message: "NOT_FOUND" });
    const saved = agreementReadSchema.parse((await run<{ value: unknown }>("select api.get_agreement($1::jsonb) as value", [{ offerId: payload.offerId }], claims(WORKER)))[0]!.value);
    expect(saved.offer.version).toBe(2);
    expect(saved.answers).toEqual([]);
    expect(saved.confirmation).toBeNull();
    expect(saved.canConfirm).toBe(false);
  });
  it("denies a different currently approved representative at the RPC boundary", async () => {
    const { payload } = await review();
    await expect(run("select api.confirm_agreement($1::jsonb)", [confirmation(payload.offerId)], claims(MEMBER))).rejects.toBeDefined();
    await expect(run("select api.review_offer($1::jsonb)", [{ ...payload, expectedVersion: 2, idempotencyKey: crypto.randomUUID() }], claims(MEMBER))).rejects.toBeDefined();
  });
  it("preserves the representative through worker amendments and rejects self-representation", async () => {
    const { payload } = await review();
    const amended = await review({ offerId: payload.offerId, requesterRole: "WORKER", expectedVersion: 2 }, WORKER);
    expect(amended.result).toMatchObject({ representativeId: APPROVER, requesterId: WORKER, version: 2 });
    const employer = confirmation(payload.offerId, { expectedVersion: 2 });
    await run("select api.confirm_agreement($1::jsonb)", [employer]);
    const completed = await run("select api.confirm_agreement($1::jsonb) as value", [{ ...employer, confirmationRole: "WORKER", idempotencyKey: crypto.randomUUID() }], claims(WORKER));
    expect(completed[0]).toMatchObject({ value: { status: "confirmed" } });
    await expect(review({ workerId: APPROVER })).rejects.toMatchObject({ message: "ACTION_FORBIDDEN" });
  });
  it("keeps worker-created drafts private and unconfirmable without explicit designation", async () => {
    const { payload, result } = await review({ requesterRole: "WORKER" }, WORKER);
    expect(result).toMatchObject({ representativeId: null });
    for (const actor of [APPROVER, MEMBER, OTHER]) {
      expect(await run("select * from private.day3_offers where offer_id = $1", [payload.offerId], claims(actor), "fw_user_exec")).toEqual([]);
    }
    await expect(run("select api.confirm_agreement($1::jsonb)", [confirmation(payload.offerId, { confirmationRole: "WORKER" })], claims(WORKER))).rejects.toMatchObject({ message: "ACTION_FORBIDDEN" });
    await expect(review({ offerId: payload.offerId, expectedVersion: 2 })).rejects.toBeDefined();
  });
  it("isolates all six tables from unrelated identities through the executor", async () => {
    const { payload, result } = await review({ terms: { ...terms, responsibilities: "" } });
    const answer = { offerId: payload.offerId, offerVersion: 1, questionId: result.unresolved[0]!.id, answer: "Discuss duties", idempotencyKey: crypto.randomUUID() };
    await run("select api.answer_offer_question($1::jsonb)", [answer], claims(WORKER));
    const employer = confirmation(payload.offerId);
    await run("select api.confirm_agreement($1::jsonb)", [employer]);
    await run("select api.confirm_agreement($1::jsonb)", [{ ...employer, confirmationRole: "WORKER", idempotencyKey: crypto.randomUUID() }], claims(WORKER));
    for (const table of ["day3_offers", "day3_offer_questions", "day3_offer_answers", "day3_agreements", "day3_effective_agreements", "day3_command_receipts"]) {
      for (const actor of [OTHER, MEMBER]) {
        expect(await run("select * from private." + table, [], claims(actor), "fw_user_exec")).toEqual([]);
      }
      expect((await run("select * from private." + table, [], claims(WORKER), "fw_user_exec")).length).toBeGreaterThan(0);
    }
    await expect(run("select api.answer_offer_question($1::jsonb)", [{ ...answer, idempotencyKey: crypto.randomUUID() }], claims(MEMBER))).rejects.toBeDefined();
    await expect(run("insert into private.day3_command_receipts(actor_id,command_name,idempotency_key,result_id,request_hash) values($1,'review_offer',$2,$3,'forged')", [APPROVER, crypto.randomUUID(), crypto.randomUUID()], claims(OTHER), "fw_user_exec")).rejects.toBeDefined();
  });
  it("denies foreign executor inserts even when the actor fields are self-attributed", async () => {
    const { payload, result } = await review({ terms: {} });
    await expect(run("insert into private.day3_offer_answers(question_id,offer_id,offer_version,answer,answered_by) values($1,$2,1,'forged',$3)", [result.unresolved[0]!.id,payload.offerId,MEMBER], claims(MEMBER), "fw_user_exec")).rejects.toMatchObject({ code: "42501" });
    await expect(run("insert into private.day3_offer_questions(id,offer_id,offer_version,company_id,worker_id,field,question,required) values($1,$2,1,$3,$4,'forged','forged',true)", [crypto.randomUUID(),payload.offerId,COMPANY,WORKER], claims(MEMBER), "fw_user_exec")).rejects.toMatchObject({ code: "42501" });
    await expect(run("insert into private.day3_agreements(agreement_id,offer_id,offer_version,company_id,worker_id,version,confirmed_by,confirmation_role,previous_hash,current_hash,unresolved,created_by) values($1,$2,1,$3,$4,1,$5,'EMPLOYER','forged','forged','[]',$5)", [crypto.randomUUID(),payload.offerId,COMPANY,WORKER,MEMBER], claims(MEMBER), "fw_user_exec")).rejects.toMatchObject({ code: "42501" });
    await expect(run("insert into private.day3_offers(offer_id,company_id,worker_id,requester_id,requester_role,representative_id,version,term_hash,snapshot,created_by) values($1,$2,$3,$3,'WORKER',null,2,'forged','{}',$3)", [payload.offerId,COMPANY,OTHER], claims(OTHER), "fw_user_exec")).rejects.toMatchObject({ message: "ACTION_FORBIDDEN" });
    await expect(run("select snapshot from private.day3_offers", [], claims(OTHER), "fw_policy_exec")).rejects.toMatchObject({ code: "42501" });
  });
  it("revocation and same-person reapproval cannot authorize an old frozen revision", async () => {
    const { payload } = await review();
    const employer = confirmation(payload.offerId);
    await run("select api.confirm_agreement($1::jsonb)", [employer]);
    for (const [decision, expectedRevision] of [["revoke", 1], ["approve", 2]] as const) {
      await run("select api.decide_membership($1::jsonb)", [{ companyId: COMPANY, subjectId: APPROVER, decision, expectedRevision, expiresAt: decision === "approve" ? new Date(Date.now()+86_400_000).toISOString() : null, reviewedEvidenceRefs: ["demo:fixture/reapproval"], reason: "Synthetic authority replacement", policyVersion: "demo-authority.v1", idempotencyKey: crypto.randomUUID() }], claims(MEMBER));
      await expect(run("select api.confirm_agreement($1::jsonb)", [{ ...employer, confirmationRole: "WORKER", idempotencyKey: crypto.randomUUID() }], claims(WORKER))).rejects.toMatchObject({ message: "ACTION_FORBIDDEN" });
      if (decision === "revoke") {
        await expect(run("select api.get_agreement($1::jsonb)", [{ offerId: payload.offerId }], claims(APPROVER))).rejects.toMatchObject({ message: "NOT_FOUND" });
        const workerView = await run<{ value: { canConfirm: boolean } }>("select api.get_agreement($1::jsonb) as value", [{ offerId: payload.offerId }], claims(WORKER));
        expect(workerView[0]!.value.canConfirm).toBe(false);
        expect(await run("select * from private.day3_offers where offer_id=$1", [payload.offerId], claims(APPROVER), "fw_user_exec")).toEqual([]);
      }
    }
    await review({ offerId: payload.offerId, expectedVersion: 2 });
    const fresh = confirmation(payload.offerId, { expectedVersion: 2 });
    await run("select api.confirm_agreement($1::jsonb)", [fresh]);
    const completed = await run("select api.confirm_agreement($1::jsonb) as value", [{ ...fresh, confirmationRole: "WORKER", idempotencyKey: crypto.randomUUID() }], claims(WORKER));
    expect(completed[0]).toMatchObject({ value: { status: "confirmed" } });
  });
});
