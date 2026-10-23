import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { localPostgresConnection } from "../local-postgres";

const realPostgres=Boolean(process.env.FAIRWORK_LOCAL_POSTGRES_PORT);
const db = realPostgres ? await localPostgresConnection() : new PGlite();
afterAll(() => db.close());
const WORKER = "40000000-0000-4000-8000-000000000012";
const APPROVER = "40000000-0000-4000-8000-000000000013";
const MEMBER = "40000000-0000-4000-8000-000000000014";
const OTHER = "40000000-0000-4000-8000-000000000015";
let COMPANY: string;

function claims(id: string, aal = "aal2") {
  return { sub: id, role: "authenticated", aal, is_anonymous: false };
}

async function run<T = Record<string, unknown>>(sql: string, params: unknown[] = [], jwt:Record<string,unknown> = claims(APPROVER), role = "authenticated") {
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
    await runMigration(await readFile("supabase/migrations/202610140001_versioned_agreements.sql", "utf8"));
    if (existsSync("supabase/migrations/202610140002_work_records.sql")) await runMigration(await readFile("supabase/migrations/202610140002_work_records.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/202610140003_work_integrity_passport.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/202610150001_work_case_review.sql", "utf8"));
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

type Version = { version: number; state: string; contentHash: string; itemSetHash: string; unresolvedIds: string[]; status: string; content: { sharedQuestions: { id: string }[]; answers: { id: string }[] }; acknowledgements: unknown[]; decisions: unknown[] };
type Workflow = { agreementId: string; currentVersion: number; effectiveVersion: number | null; versions: Version[] };
async function command(input: Record<string, unknown>, actor = WORKER) {
  return (await run<{ value: Record<string, unknown> }>("select api.agreement_workflow($1::jsonb) value", [{ idempotencyKey: crypto.randomUUID(), ...input }], claims(actor)))[0]!.value;
}
async function read(id: string, actor = WORKER) {
  return (await run<{ value: Workflow }>("select api.read_agreement_workflow($1::jsonb) value", [{ agreementId: id }], claims(actor)))[0]!.value;
}
async function source(overrides: Record<string, unknown> = {}) {
  const input = { offerId: crypto.randomUUID(), companyId: COMPANY, workerId: WORKER, requesterRole: "WORKER", terms: { salary: 120000, currency: "LKR", startDate: "2026-01-02", hoursPerWeek: 40, responsibilities: "Engineering" }, expectedVersion: 1, idempotencyKey: crypto.randomUUID(), ...overrides };
  const value = (await run<{ value: { termHash: string; unresolved: {id:string}[] } }>("select api.review_offer($1::jsonb) value", [input], claims(WORKER)))[0]!.value;
  return { ...input, ...value };
}
async function draft() {
  const offer = await source();
  const id = crypto.randomUUID();
  const input = { operation: "create", agreementId: id, offerId: offer.offerId, offerVersion: 1, expectedSourceHash: offer.termHash, representativeId: APPROVER, idempotencyKey: crypto.randomUUID() };
  await command(input);
  return { id, offer, input, view: await read(id) };
}
function expected(id: string, v: Version) { return { agreementId: id, expectedVersion: v.version, expectedHash: v.contentHash, expectedState: v.state }; }
async function propose(id: string) {
  const v = (await read(id)).versions.at(-1)!;
  await command({ operation: "propose", ...expected(id,v), sharedQuestionIds: v.content.sharedQuestions.map(q=>q.id) });
  return (await read(id)).versions.at(-1)!;
}
function acknowledgement(id: string,v: Version) { return { ...expected(id,v), acknowledgedItemIds: v.unresolvedIds, expectedItemSetHash: v.itemSetHash }; }
async function clearQuotas() { await db.exec("delete from private.rate_limit_buckets"); }

type WorkVersion={version:number;state:string;contentHash:string;evidenceHash:string;content:{evidence:{id:string;text:string}[]};decision:null|{id:string;outcome:string}};
type Work={workId:string;currentVersion:number;versions:WorkVersion[]};
async function work(input:Record<string,unknown>,actor=WORKER) {
 return (await run<{value:Record<string,unknown>}>("select api.work_command($1::jsonb) value",[{idempotencyKey:crypto.randomUUID(),...input}],claims(actor)))[0]!.value;
}
async function workRead(id:string,actor=WORKER) {return (await run<{value:Work}>("select api.read_work($1::jsonb) value",[{workId:id}],claims(actor)))[0]!.value;}
async function effective() {
 await clearQuotas(); const d=await draft();const v=await propose(d.id);
 for(const actor of [WORKER,APPROVER]) {await command({operation:"acknowledge",...acknowledgement(d.id,v)},actor);await command({operation:"decide",...acknowledgement(d.id,v),decision:"confirm"},actor);}
 return d;
}
const payload={role:"Engineer",periodStart:"2026-01-02",periodEnd:"2026-01-02",hours:"8.00",tasks:"Completed maintenance",evidence:["Maintenance log checked by the worker"]};
function workExpected(id:string,v:WorkVersion) {return {workId:id,expectedVersion:v.version,expectedHash:v.contentHash,expectedState:v.state,expectedEvidenceHash:v.evidenceHash};}
async function created() {const d=await effective();const id=crypto.randomUUID();const input={operation:"create",workId:id,agreementId:d.id,agreementVersion:1,payload,idempotencyKey:crypto.randomUUID()};await work(input);return {id,input,d,v:(await workRead(id)).versions[0]!};}
async function submitted() {const c=await created();await work({operation:"submit",...workExpected(c.id,c.v)});return {...c,v:(await workRead(c.id)).versions[0]!};}

describe("Day 5 denial-first persistent work",()=>{
 it("denies unauthenticated creation",async()=>{await expect(run("select api.work_command($1::jsonb)",[{operation:"create"}],{})).rejects.toThrow("AUTH_REQUIRED");});
 it("denies draft and proposed non-effective agreement bases",async()=>{await clearQuotas();const d=await draft();const input={operation:"create",workId:crypto.randomUUID(),agreementId:d.id,agreementVersion:1,payload};await expect(work(input)).rejects.toThrow("ACTION_FORBIDDEN");await propose(d.id);await expect(work(input)).rejects.toThrow("ACTION_FORBIDDEN");});
 for(const field of ["workerId","companyId"]) it(`denies forged ${field}`,async()=>{const d=await effective();await expect(work({operation:"create",workId:crypto.randomUUID(),agreementId:d.id,agreementVersion:1,payload,[field]:OTHER})).rejects.toThrow("VALIDATION_FAILED");});
 it("denies a forged agreement revision",async()=>{const d=await effective();await expect(work({operation:"create",workId:crypto.randomUUID(),agreementId:d.id,agreementVersion:99,payload})).rejects.toThrow("VERSION_CONFLICT");});
 it("keeps drafts private and denies cross-tenant reads and updates",async()=>{const c=await created();for(const actor of [APPROVER,OTHER]) {await expect(workRead(c.id,actor)).rejects.toThrow("NOT_FOUND");await expect(work({operation:"revise",...workExpected(c.id,c.v),agreementVersion:1,payload},actor)).rejects.toThrow("NOT_FOUND");}});
 it("denies employer creation through a worker identity",async()=>{const d=await effective();await expect(work({operation:"create",workId:crypto.randomUUID(),agreementId:d.id,agreementVersion:1,payload},APPROVER)).rejects.toThrow("ACTION_FORBIDDEN");});
 it("denies worker self-verification even with company authority",async()=>{const c=await submitted();await expect(work({operation:"decide",...workExpected(c.id,c.v),outcome:"verified",reason:"Reviewed"})).rejects.toThrow("ACTION_FORBIDDEN");});
 it("replays once, rejects changed input and stale revisions without partial writes",async()=>{const c=await created();const first=await work(c.input);expect(await work(c.input)).toEqual(first);await expect(work({...c.input,payload:{...payload,hours:"7.00"}})).rejects.toThrow("IDEMPOTENCY_CONFLICT");await work({operation:"revise",...workExpected(c.id,c.v),agreementVersion:1,payload:{...payload,evidence:["Replacement statement"]}});await expect(work({operation:"submit",...workExpected(c.id,c.v)})).rejects.toThrow("VERSION_CONFLICT");const view=await workRead(c.id);expect(view.versions).toHaveLength(2);expect(view.versions[0]!.content.evidence[0]!.text).toBe(payload.evidence[0]);expect((await db.query<{n:number}>("select count(*)::int n from private.audit_logs where request_id=$1",[c.input.idempotencyKey])).rows[0]!.n).toBe(1);});
 it("denies unauthorized evidence retrieval",async()=>{const c=await created();const evidenceId=c.v.content.evidence[0]!.id;for(const actor of [OTHER,APPROVER]) await expect(run("select api.read_work_evidence($1::jsonb)",[{evidenceId}],claims(actor))).rejects.toThrow("NOT_FOUND");expect((await run<{value:{text:string}}>("select api.read_work_evidence($1::jsonb) value",[{evidenceId}],claims(WORKER)))[0]!.value.text).toBe(payload.evidence[0]);});
 it("freezes submission, exact evidence, immutable independent receipt and reopen",async()=>{const c=await submitted();await expect(work({operation:"decide",...workExpected(c.id,c.v),expectedEvidenceHash:"0".repeat(64),outcome:"verified",reason:"Reviewed"},APPROVER)).rejects.toThrow("VERSION_CONFLICT");const input={operation:"decide",...workExpected(c.id,c.v),outcome:"verified",reason:"Reviewed exact log",idempotencyKey:crypto.randomUUID()};const receipt=await work(input,APPROVER);expect(await work(input,APPROVER)).toEqual(receipt);const v=(await workRead(c.id,APPROVER)).versions[0]!;expect(v.state).toBe("verified");expect(v.decision?.outcome).toBe("verified");await expect(work({...input,outcome:"rejected",idempotencyKey:crypto.randomUUID()},APPROVER)).rejects.toThrow("VERSION_CONFLICT");await expect(db.exec("update private.work_evidence set text='tampered' where work_id='"+c.id+"'")).rejects.toThrow("ACTION_FORBIDDEN");await work({operation:"reopen",...workExpected(c.id,v),agreementVersion:1,payload});expect((await workRead(c.id)).versions.map(v=>v.state)).toEqual(["superseded","draft"]);expect((await workRead(c.id,APPROVER)).versions).toHaveLength(1);});
 it("persists disputed and rejected outcomes",async()=>{for(const outcome of ["disputed","rejected"]) {const c=await submitted();await work({operation:"decide",...workExpected(c.id,c.v),outcome,reason:"Evidence does not support the reported hours"},APPROVER);expect((await workRead(c.id)).versions[0]!.state).toBe(outcome);}});
 it("denies revoked and reapproved stale authority",async()=>{const c=await submitted();const membership={companyId:COMPANY,subjectId:APPROVER,decision:"revoke",expectedRevision:1,expiresAt:null,reviewedEvidenceRefs:["demo:fixture/revoke"],reason:"Synthetic revocation",policyVersion:"demo-authority.v1",idempotencyKey:crypto.randomUUID()};await run("select api.decide_membership($1::jsonb)",[membership],claims(MEMBER));await expect(workRead(c.id,APPROVER)).rejects.toThrow("NOT_FOUND");await expect(work({operation:"decide",...workExpected(c.id,c.v),outcome:"verified",reason:"Reviewed"},APPROVER)).rejects.toThrow("NOT_FOUND");await run("select api.decide_membership($1::jsonb)",[{...membership,decision:"approve",expectedRevision:2,expiresAt:new Date(Date.now()+86400000).toISOString(),idempotencyKey:crypto.randomUUID()}],claims(MEMBER));await expect(work({operation:"decide",...workExpected(c.id,c.v),outcome:"verified",reason:"Reviewed"},APPROVER)).rejects.toThrow("VERSION_CONFLICT");});
 it("denies expired authority",async()=>{
 const membership={companyId:COMPANY,subjectId:APPROVER,decision:"approve",expectedRevision:3,expiresAt:new Date(Date.now()+3000).toISOString(),reviewedEvidenceRefs:["demo:fixture/expiry"],reason:"Synthetic expiry",policyVersion:"demo-authority.v1",idempotencyKey:crypto.randomUUID()};
 await run("select api.decide_membership($1::jsonb)",[membership],claims(MEMBER));
 const c=await submitted();await new Promise(resolve=>setTimeout(resolve,3100));
 await expect(workRead(c.id,APPROVER)).rejects.toThrow("NOT_FOUND");
 await expect(work({operation:"submit",...workExpected(c.id,c.v)})).rejects.toThrow("ACTION_FORBIDDEN");
 await run("select api.decide_membership($1::jsonb)",[{...membership,expectedRevision:4,expiresAt:new Date(Date.now()+86400000).toISOString(),idempotencyKey:crypto.randomUUID()}],claims(MEMBER));
 });
 it.runIf(realPostgres)("serializes concurrent conflicting verification",async()=>{const c=await submitted();const clients=await Promise.all([localPostgresConnection(true),localPostgresConnection(true)]);try {for(const connection of clients){await connection.exec("begin;set local role authenticated");await connection.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(APPROVER))]);}const outcomes=await Promise.allSettled(clients.map(async(connection,index)=>{try {const result=await connection.query("select api.work_command($1::jsonb)",[{operation:"decide",...workExpected(c.id,c.v),outcome:index?"rejected":"verified",reason:"Independent review",idempotencyKey:crypto.randomUUID()}]);await connection.exec("commit");return result;}catch(error){await connection.exec("rollback");throw error;}}));expect(outcomes.filter(v=>v.status==="fulfilled")).toHaveLength(1);expect(outcomes.filter(v=>v.status==="rejected")).toHaveLength(1);expect((await db.query<{n:number}>("select count(*)::int n from private.work_decisions where work_id=$1",[c.id])).rows[0]!.n).toBe(1);}finally{await Promise.all(clients.map(c=>c.close()));}});
 it("retains effective basis through a pending amendment but rejects replaced effective terms",async()=>{
 const c=await created();await clearQuotas();const old=(await read(c.d.id)).versions[0]!;
 const next=await source({offerId:c.d.offer.offerId,expectedVersion:2,terms:{...c.d.offer.terms,salary:130000}});
 await command({operation:"amend",...expected(c.d.id,old),offerId:next.offerId,offerVersion:2,expectedSourceHash:next.termHash});
 await work({operation:"submit",...workExpected(c.id,c.v)});
 const proposal=await propose(c.d.id);for(const actor of [WORKER,APPROVER]){await command({operation:"acknowledge",...acknowledgement(c.d.id,proposal)},actor);await command({operation:"decide",...acknowledgement(c.d.id,proposal),decision:"confirm"},actor);}
 const submitted=(await workRead(c.id)).versions[0]!;
 await expect(work({operation:"decide",...workExpected(c.id,submitted),outcome:"verified",reason:"Reviewed"},APPROVER)).rejects.toThrow("VERSION_CONFLICT");
 await work({operation:"reopen",...workExpected(c.id,submitted),agreementVersion:2,payload});
 const view=await workRead(c.id);expect(view.versions).toHaveLength(2);expect((view.versions[0]!.content as unknown as {agreement:{version:number}}).agreement.version).toBe(1);expect((view.versions[1]!.content as unknown as {agreement:{version:number}}).agreement.version).toBe(2);
 });
 it("validates evidence/period/scope and prevents editing submitted data",async()=>{
 const c=await created();for(const invalid of [{...payload,hours:"25"},{...payload,periodEnd:"2025-12-31"},{...payload,evidence:[{path:"private/other"}]},{...payload,workerId:OTHER},{...payload,periodStart:"2026-01-01"}])await expect(work({operation:"revise",...workExpected(c.id,c.v),agreementVersion:1,payload:invalid})).rejects.toThrow("VALIDATION_FAILED");
 await work({operation:"submit",...workExpected(c.id,c.v)});const v=(await workRead(c.id)).versions[0]!;
 await expect(work({operation:"revise",...workExpected(c.id,v),agreementVersion:1,payload})).rejects.toThrow("VERSION_CONFLICT");
 const items=(await run<{value:{items:{workId:string}[]}}>("select api.list_work($1::jsonb) value",[{cursor:null}],claims(OTHER)))[0]!.value.items;expect(items).toHaveLength(0);
 await expect(run("select api.read_work_evidence($1::jsonb)",[{evidenceId:c.v.content.evidence[0]!.id}],claims(OTHER))).rejects.toThrow("NOT_FOUND");
 expect((await run<{value:{text:string}}>("select api.read_work_evidence($1::jsonb) value",[{evidenceId:c.v.content.evidence[0]!.id}],claims(APPROVER)))[0]!.value.text).toBe(payload.evidence[0]);
 });
 it("enforces narrow catalog grants and private immutable history",async()=>{
 const checks=await db.exec(await readFile("scripts/day5-catalog.sql","utf8"));expect(checks.at(-1)!.rows).toHaveLength(9);expect(checks.at(-1)!.rows.map(r=>r.result)).toEqual(Array(9).fill("PASS"));
 for(const role of ["anon","authenticated","service_role"]){await expect(run("select * from private.work_evidence",[],claims(WORKER),role)).rejects.toThrow();}
 await expect(run("select api.work_command('{}'::jsonb)",[],claims(WORKER),"anon")).rejects.toThrow("permission denied");
 });
 it.runIf(realPostgres)("a new database session reopens saved records and evidence without client state",async()=>{
 const c=await submitted(),connection=await localPostgresConnection(true);
 try{await connection.exec("begin;set local role authenticated");await connection.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(APPROVER))]);
 const view=await connection.query<{value:Work}>("select api.read_work($1::jsonb) value",[{workId:c.id}]);expect(view.rows[0]!.value.versions[0]!.contentHash).toBe(c.v.contentHash);expect(view.rows[0]!.value.versions[0]!.content.evidence[0]!.text).toBe(payload.evidence[0]);await connection.exec("commit");
 }finally{await connection.exec("rollback");await connection.close();}
 });
 it.runIf(realPostgres)("committed revocation while verification waits prevents a decision and audit",async()=>{
 const c=await submitted(),revoker=await localPostgresConnection(true),verifier=await localPostgresConnection(true),key=crypto.randomUUID();
 try {
 await revoker.exec("begin;set local role authenticated");await revoker.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(MEMBER))]);
 await revoker.query("select api.decide_membership($1::jsonb)",[{companyId:COMPANY,subjectId:APPROVER,decision:"revoke",expectedRevision:5,expiresAt:null,reviewedEvidenceRefs:["demo:fixture/day5"],reason:"Concurrent work revocation",policyVersion:"demo-authority.v1",idempotencyKey:crypto.randomUUID()}]);
 await verifier.exec("begin;set local role authenticated");await verifier.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(APPROVER))]);
 const pending=verifier.query("select api.work_command($1::jsonb)",[{operation:"decide",...workExpected(c.id,c.v),outcome:"verified",reason:"Reviewed",idempotencyKey:key}]).then(()=>({accepted:true,error:""}),error=>({accepted:false,error:String(error)}));
 let waiting=0;for(let i=0;i<100;i++){waiting=(await db.query<{n:number}>("select count(*)::int n from pg_locks where locktype='advisory' and not granted")).rows[0]!.n;if(waiting)break;await new Promise(resolve=>setTimeout(resolve,25));}
 await revoker.exec("commit");const result=await pending;expect(waiting).toBe(1);expect(result.accepted).toBe(false);expect(result.error).toContain("ACTION_FORBIDDEN");await verifier.exec("rollback");
 expect((await workRead(c.id)).versions[0]!.state).toBe("submitted");expect((await db.query<{n:number}>("select count(*)::int n from private.work_decisions where work_id=$1",[c.id])).rows[0]!.n).toBe(0);expect((await db.query<{n:number}>("select count(*)::int n from private.audit_logs where request_id=$1",[key])).rows[0]!.n).toBe(0);
 }finally{await revoker.exec("rollback");await verifier.exec("rollback");await revoker.close();await verifier.close();}
 });

});

