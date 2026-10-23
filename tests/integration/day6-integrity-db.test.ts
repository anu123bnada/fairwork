import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { localPostgresConnection } from "../local-postgres";
import { passportSchema } from "../../src/features/work/passport-schema";
import { workReadSchema } from "../../src/features/work/schema";

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
    await runMigration(await readFile("supabase/migrations/202610140002_work_records.sql", "utf8"));
    if(existsSync("supabase/migrations/202610140003_work_integrity_passport.sql")) await runMigration(await readFile("supabase/migrations/202610140003_work_integrity_passport.sql", "utf8"));
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

type Passport={passportId:string|null;ownerId:string;entries:{workId:string;version:number;verificationId:string;summary:string}[];nextCursor:string|null};
async function integrity(input:Record<string,unknown>,actor=WORKER){return (await run<{value:Record<string,unknown>}>("select api.work_integrity($1::jsonb) value",[{idempotencyKey:crypto.randomUUID(),...input}],claims(actor)))[0]!.value;}
async function passport(actor=WORKER,extra:Record<string,unknown>={}){return (await run<{value:Passport}>("select api.read_passport($1::jsonb) value",[{cursor:null,...extra}],claims(actor)))[0]!.value;}
async function initialize(actor=WORKER,key=crypto.randomUUID()){return (await run<{value:Record<string,unknown>}>("select api.initialize_passport($1::jsonb) value",[{idempotencyKey:key}],claims(actor)))[0]!.value;}
async function verified(){const c=await submitted();await work({operation:"decide",...workExpected(c.id,c.v),outcome:"verified",reason:"Reviewed exact work"},APPROVER);return {...c,v:(await workRead(c.id)).versions[0]!};}
const withdraw=(c:{id:string;v:WorkVersion})=>({operation:"withdraw",...workExpected(c.id,c.v),reason:"Worker no longer presents this record"});
const correct=(c:{id:string;v:WorkVersion})=>({operation:"correct",...workExpected(c.id,c.v),agreementVersion:1,payload:{...payload,hours:"7.00"},reason:"Corrected hours from the original log"});
async function membership(decision:"approve"|"revoke",expiresAt:string|null=decision==="approve"?new Date(Date.now()+86400000).toISOString():null){const revision=(await db.query<{revision:number}>("select revision::int revision from private.company_memberships where company_id=$1 and subject_id=$2",[COMPANY,APPROVER])).rows[0]!.revision;return run("select api.decide_membership($1::jsonb)",[{companyId:COMPANY,subjectId:APPROVER,decision,expectedRevision:revision,expiresAt,reviewedEvidenceRefs:["demo:fixture/day6"],reason:"Synthetic Day 6 authority change",policyVersion:"demo-authority.v1",idempotencyKey:crypto.randomUUID()}],claims(MEMBER));}

describe("Day 6 denial-first integrity and private Passport",()=>{
 it("enforces FORCE RLS, narrow RPC grants and immutable integrity history",async()=>{
  const checks=await db.exec(await readFile("scripts/day6-catalog.sql","utf8"));expect(checks.at(-1)!.rows.map(r=>r.result)).toEqual(Array(6).fill("PASS"));
  for(const role of ["anon","authenticated","service_role"])for(const table of ["work_integrity_events","work_integrity_receipts","work_passports"])await expect(run(`select * from private.${table}`,[],claims(WORKER),role)).rejects.toThrow();
  const c=await verified();await integrity(withdraw(c));
  for(const statement of ["update private.work_integrity_events set reason='rewritten'", "delete from private.work_integrity_events", "update private.work_integrity_receipts set result='{}'"])await expect(db.exec(statement)).rejects.toThrow("ACTION_FORBIDDEN");
 });
 it("denies unauthenticated integrity and Passport requests",async()=>{for(const rpc of ["work_integrity","read_passport","initialize_passport"])await expect(run(`select api.${rpc}($1::jsonb)`,[{}],{})).rejects.toThrow("AUTH_REQUIRED");});
 it("denies forged actor/company/status fields and invalid reasons",async()=>{const c=await verified();for(const extra of [{workerId:OTHER},{companyId:COMPANY},{state:"withdrawn"},{reason:""},{reason:null}])await expect(integrity({...withdraw(c),...extra})).rejects.toThrow("VALIDATION_FAILED");});
 it("denies other tenant and representative withdrawal",async()=>{const c=await verified();await expect(integrity(withdraw(c),OTHER)).rejects.toThrow("NOT_FOUND");await expect(integrity(withdraw(c),APPROVER)).rejects.toThrow("ACTION_FORBIDDEN");});
 it("withdraws once, keeps evidence/decision history and rejects old direct write paths",async()=>{const c=await verified();await initialize();expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(true);const input={...withdraw(c),idempotencyKey:crypto.randomUUID()};const receipt=await integrity(input);expect(await integrity(input)).toEqual(receipt);await expect(integrity({...input,reason:"Different input"})).rejects.toThrow("IDEMPOTENCY_CONFLICT");expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(false);const view=await workRead(c.id);expect(view.versions[0]!.state).toBe("withdrawn");expect(view.versions[0]!.decision?.outcome).toBe("verified");expect(view.versions[0]!.content.evidence[0]!.text).toBe(payload.evidence[0]);for(const operation of ["reopen","revise"])await expect(work({operation,...workExpected(c.id,view.versions[0]!),agreementVersion:1,payload})).rejects.toThrow("ACTION_FORBIDDEN");expect((await db.query<{n:number}>("select count(*)::int n from private.audit_logs where request_id=$1",[input.idempotencyKey])).rows[0]!.n).toBe(1);});
 it("rejects stale withdrawals and unauthorized or forged-basis corrections",async()=>{const c=await verified();await expect(integrity({...withdraw(c),expectedHash:"0".repeat(64)})).rejects.toThrow("VERSION_CONFLICT");await expect(integrity(correct(c),OTHER)).rejects.toThrow("NOT_FOUND");await expect(integrity(correct(c),APPROVER)).rejects.toThrow("ACTION_FORBIDDEN");await expect(integrity({...correct(c),agreementVersion:99})).rejects.toThrow("VERSION_CONFLICT");expect((await workRead(c.id)).currentVersion).toBe(1);});
 it("correction suppresses eligibility atomically and requires a new independent decision",async()=>{const c=await verified();await initialize();const input={...correct(c),idempotencyKey:crypto.randomUUID()};const receipt=await integrity(input);expect(await integrity(input)).toEqual(receipt);let view=await workRead(c.id);expect(view.versions.map(v=>v.state)).toEqual(["superseded","draft"]);expect(view.versions[0]!.decision?.outcome).toBe("verified");expect(view.versions[1]!.decision).toBeNull();expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(false);await expect(work({operation:"decide",...workExpected(c.id,c.v),outcome:"verified",reason:"Stale"},APPROVER)).rejects.toThrow();await work({operation:"submit",...workExpected(c.id,view.versions[1]!)});view=await workRead(c.id);await work({operation:"decide",...workExpected(c.id,view.versions[1]!),outcome:"verified",reason:"Reviewed corrected hours"},APPROVER);expect((await passport()).entries.find(e=>e.workId===c.id)?.version).toBe(2);});
 it("excludes draft, pending, disputed and rejected records on the server",async()=>{await initialize();for(const outcome of ["draft","submitted","disputed","rejected"]){const c=outcome==="draft"?await created():await submitted();if(outcome==="disputed"||outcome==="rejected")await work({operation:"decide",...workExpected(c.id,c.v),outcome,reason:"Cannot verify"},APPROVER);expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(false);}});
 it("retains ordinary historical verification after departure but denies representative access and permits owner withdrawal",async()=>{const c=await verified();await initialize();await membership("revoke");try{expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(true);await expect(workRead(c.id,APPROVER)).rejects.toThrow("NOT_FOUND");await expect(integrity({operation:"retract",...workExpected(c.id,c.v),reason:"Retract"},APPROVER)).rejects.toThrow("NOT_FOUND");await integrity(withdraw(c));expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(false);}finally{await membership("approve");}});
 it("only the current original verifier can retract, and a receipt cannot restore invalidated eligibility",async()=>{const c=await verified();await initialize();const input={operation:"retract",...workExpected(c.id,c.v),reason:"Evidence review was incorrect",idempotencyKey:crypto.randomUUID()};for(const actor of [WORKER,MEMBER])await expect(integrity(input,actor)).rejects.toThrow();const receipt=await integrity(input,APPROVER);expect(await integrity(input,APPROVER)).toEqual(receipt);expect((await workRead(c.id)).versions[0]!.state).toBe("invalidated");expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(false);expect((await db.query<{n:number}>("select count(*)::int n from private.work_decisions where work_id=$1 and outcome='verified'",[c.id])).rows[0]!.n).toBe(1);});
 it("keeps Passport owner-private and omits raw evidence and reasons",async()=>{const c=await verified();const key=crypto.randomUUID();const first=await initialize(WORKER,key);expect(await initialize(WORKER,key)).toEqual(first);await initialize(OTHER);expect((await passport(OTHER)).entries).toEqual([]);await expect(passport(OTHER,{ownerId:WORKER})).rejects.toThrow("VALIDATION_FAILED");const view=await passport();expect(view.passportId).toBeTruthy();expect(view.entries.find(e=>e.workId===c.id)).toBeTruthy();expect(JSON.stringify(view)).not.toContain(payload.evidence[0]);expect(JSON.stringify(view)).not.toContain("Reviewed exact work");});
 it("matches the strict real API DTOs and denies suspended-owner replay",async()=>{
  const c=await verified();await initialize();expect(passportSchema.safeParse(await passport()).success).toBe(true);const input={...withdraw(c),idempotencyKey:crypto.randomUUID()};await integrity(input);expect(workReadSchema.safeParse(await workRead(c.id)).success).toBe(true);
  await db.query("update private.profiles set account_state='suspended' where id=$1",[WORKER]);
  try{await expect(integrity(input)).rejects.toThrow("AUTH_REQUIRED");await expect(passport()).rejects.toThrow("AUTH_REQUIRED");await expect(initialize()).rejects.toThrow("AUTH_REQUIRED");}finally{await db.query("update private.profiles set account_state='active' where id=$1",[WORKER]);}
 });
 it("a replaced agreement cannot silently retarget work history or corrections",async()=>{
  const c=await verified();await initialize();const old=(await read(c.d.id)).versions[0]!;
  const next=await source({offerId:c.d.offer.offerId,expectedVersion:2,terms:{...c.d.offer.terms,salary:130000}});
  await command({operation:"amend",...expected(c.d.id,old),offerId:next.offerId,offerVersion:2,expectedSourceHash:next.termHash});
  const proposal=await propose(c.d.id);for(const actor of [WORKER,APPROVER]){await command({operation:"acknowledge",...acknowledgement(c.d.id,proposal)},actor);await command({operation:"decide",...acknowledgement(c.d.id,proposal),decision:"confirm"},actor);}
  const entry=passportSchema.parse(await passport()).entries.find(e=>e.workId===c.id);expect(entry?.agreementVersion).toBe(1);
  await expect(integrity(correct(c))).rejects.toThrow("VERSION_CONFLICT");await integrity({...correct(c),agreementVersion:2});expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(false);
 });
 it("expired authority cannot retract or correct, while ordinary historical verification remains private",async()=>{
  await membership("approve",new Date(Date.now()+5000).toISOString());const c=await verified();await initialize();await new Promise(resolve=>setTimeout(resolve,5100));
  try{expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(true);await expect(integrity({operation:"retract",...workExpected(c.id,c.v),reason:"Expired"},APPROVER)).rejects.toThrow("NOT_FOUND");await expect(integrity(correct(c))).rejects.toThrow("ACTION_FORBIDDEN");await integrity(withdraw(c));}finally{await membership("approve");}
 });
 it.runIf(realPostgres)("a new connection reopens the persistent private Passport and correction history",async()=>{
  const c=await verified();const root=await initialize();await integrity(correct(c));const connection=await localPostgresConnection(true);
  try{await connection.exec("begin;set local role authenticated");await connection.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(WORKER))]);const view=(await connection.query<{value:Passport}>("select api.read_passport($1::jsonb) value",[{cursor:null}])).rows[0]!.value;expect(view.passportId).toBe(root.passportId);expect(view.entries.some(e=>e.workId===c.id)).toBe(false);const record=(await connection.query<{value:unknown}>("select api.read_work($1::jsonb) value",[{workId:c.id}])).rows[0]!.value;expect(workReadSchema.parse(record).integrityEvents?.[0]?.reason).toBe(correct(c).reason);await connection.exec("commit");}finally{await connection.exec("rollback");await connection.close();}
 });
 it.runIf(realPostgres)("a committed revocation denies waiting retraction without writing an invalidation",async()=>{
  const c=await verified(),revoker=await localPostgresConnection(true),verifier=await localPostgresConnection(true),key=crypto.randomUUID();
  const revision=(await db.query<{revision:number}>("select revision::int revision from private.company_memberships where company_id=$1 and subject_id=$2",[COMPANY,APPROVER])).rows[0]!.revision;
  try{await revoker.exec("begin;set local role authenticated");await revoker.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(MEMBER))]);await revoker.query("select api.decide_membership($1::jsonb)",[{companyId:COMPANY,subjectId:APPROVER,decision:"revoke",expectedRevision:revision,expiresAt:null,reviewedEvidenceRefs:["demo:fixture/day6-race"],reason:"Concurrent revocation",policyVersion:"demo-authority.v1",idempotencyKey:crypto.randomUUID()}]);
   await verifier.exec("begin;set local role authenticated");await verifier.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(APPROVER))]);
   const pending=verifier.query("select api.work_integrity($1::jsonb)",[{operation:"retract",...workExpected(c.id,c.v),reason:"Retract",idempotencyKey:key}]).then(()=>true,()=>false);
   let waiting=0;for(let i=0;i<100;i++){waiting=(await db.query<{n:number}>("select count(*)::int n from pg_locks where locktype='advisory' and not granted")).rows[0]!.n;if(waiting)break;await new Promise(resolve=>setTimeout(resolve,25));}
   await revoker.exec("commit");expect(await pending).toBe(false);expect(waiting).toBe(1);await verifier.exec("rollback");expect((await workRead(c.id)).versions[0]!.state).toBe("verified");expect((await db.query<{n:number}>("select count(*)::int n from private.audit_logs where request_id=$1",[key])).rows[0]!.n).toBe(0);
  }finally{await revoker.exec("rollback");await verifier.exec("rollback");await revoker.close();await verifier.close();await membership("approve");}
 });
 it.runIf(realPostgres)("serializes correction, withdrawal and verification against each other",async()=>{
  for(const pair of ["decide-correct","withdraw-correct","withdraw-decide"]){const c=pair==="withdraw-correct"?await verified():await submitted();const clients=await Promise.all([localPostgresConnection(true),localPostgresConnection(true)]);try{
   const actors=pair==="decide-correct"?[APPROVER,WORKER]:pair==="withdraw-decide"?[WORKER,APPROVER]:[WORKER,WORKER];for(let i=0;i<2;i++){await clients[i]!.exec("begin;set local role authenticated");await clients[i]!.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(actors[i]!))]);}
   const decide={operation:"decide",...workExpected(c.id,c.v),outcome:"verified",reason:"Reviewed"};const inputs=pair==="decide-correct"?[decide,correct(c)]:pair==="withdraw-decide"?[withdraw(c),decide]:[withdraw(c),correct(c)];
   const results=await Promise.allSettled(clients.map(async(connection,index)=>{try{const result=await connection.query(`select api.${inputs[index]!.operation==="decide"?"work_command":"work_integrity"}($1::jsonb)`,[{...inputs[index],idempotencyKey:crypto.randomUUID()}]);await connection.exec("commit");return result;}catch(error){await connection.exec("rollback");throw error;}}));expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);
  }finally{await Promise.all(clients.map(c=>c.close()));}}
 });
 it.runIf(realPostgres)("concurrent duplicate withdrawal returns one immutable receipt and one audit",async()=>{
  const c=await verified(),input={...withdraw(c),idempotencyKey:crypto.randomUUID()},clients=await Promise.all([localPostgresConnection(true),localPostgresConnection(true)]);
  try{for(const connection of clients){await connection.exec("begin;set local role authenticated");await connection.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(WORKER))]);}
   const receipts=await Promise.all(clients.map(async connection=>{const result=await connection.query<{value:unknown}>("select api.work_integrity($1::jsonb) value",[input]);await connection.exec("commit");return result.rows[0]!.value;}));expect(receipts[0]).toEqual(receipts[1]);expect((await db.query<{n:number}>("select count(*)::int n from private.audit_logs where request_id=$1",[input.idempotencyKey])).rows[0]!.n).toBe(1);
  }finally{for(const connection of clients){await connection.exec("rollback");await connection.close();}}
 });
});

