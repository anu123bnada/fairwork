import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { localPostgresConnection } from "../local-postgres";
import { caseReadSchema,caseReceiptSchema,caseListSchema } from "../../src/features/cases/schema";
import { pending, stageSQL, constraintSQL } from "../../scripts/activation-checks.mjs";
import { twoAccountFlow } from "../../scripts/hosted-two-account-flow.mjs";
import { passportReadRequestSchema } from "../../src/features/work/passport-schema";



const realPostgres=Boolean(process.env.FAIRWORK_LOCAL_POSTGRES_PORT);
const db = realPostgres ? await localPostgresConnection() : new PGlite();
afterAll(() => db.close());
const WORKER = "40000000-0000-4000-8000-000000000012";
const APPROVER = "40000000-0000-4000-8000-000000000013";
const MEMBER = "40000000-0000-4000-8000-000000000014";
const OTHER = "40000000-0000-4000-8000-000000000015";
const REVIEWER="40000000-0000-4000-8000-000000000016", OPERATOR="40000000-0000-4000-8000-000000000017";
let COMPANY: string;
const activationStages: number[] = [];
let foundationRowsPreserved = false;
const foundationTables = ['profiles','capability_assignments','audit_logs','command_receipts','rate_limit_buckets','companies','company_memberships','company_membership_decisions'];
async function foundationSnapshot() {
  const snapshot:unknown[]=[];
  for (const table of foundationTables) snapshot.push((await db.query(`select count(*)::int as count, encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text),''),'UTF8')),'hex') as hash from private.${table} t`)).rows);
  return snapshot;
}
async function checkActivationStage(stage: number) {
  // The fixture does not maintain CLI history for each migration; catalog checks
  // run at every real migration boundary. Hosted SQL also checks exact history.
  const results = await db.exec(stageSQL(stage, { history: false }));
  const rows = results.flatMap(result => result.rows).filter(row => row.result);
  expect(rows.length).toBeGreaterThanOrEqual(8);
  expect(rows.filter(row => row.result !== "PASS")).toEqual([]);
  if(realPostgres) {
    // Only constraint definitions, never row contents. This catches drift in the
    // shared checks that subsequent migrations replace and validate against data.
    const constraints=await db.query<{name:string;hash:string}>(`select c.conname as name, encode(sha256(convert_to(pg_get_constraintdef(c.oid),'UTF8')),'hex') as hash from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname='private' and c.conname in ('audit_logs_action_check','audit_logs_reason_code_check','rate_limit_buckets_operation_check','work_record_versions_state_check') order by c.conname`);
    const sql=constraintSQL(stage,constraints.rows);
    await mkdir('test-results/activation-plan',{recursive:true});
    await writeFile(`test-results/activation-plan/constraints-stage-${stage}.sql`,sql);
    const comparison=await db.exec(sql);
    expect(comparison.flatMap(r=>r.rows).filter(r=>r.result&&r.result!=='PASS')).toEqual([]);
  }
  activationStages.push(stage);
}

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
  for (const id of [WORKER, APPROVER, MEMBER, OTHER, REVIEWER, OPERATOR]) {
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
  await db.exec(`insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at) values('${REVIEWER}','reviewer','${OPERATOR}','Synthetic Day 7',now()+interval '1 day'),('${OPERATOR}','review_operator','${MEMBER}','Synthetic Day 7',now()+interval '1 day')`);

  const beforeRows=await foundationSnapshot();
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
    await checkActivationStage(0);
    for (const [index, migration] of pending.entries()) {
      await runMigration(await readFile(`supabase/migrations/${migration[0]}`, "utf8"));
      await checkActivationStage(index + 1);
    }
  } catch (error) {
    await db.exec("rollback").catch(() => undefined);
    throw error;
  } finally {
    await db.exec("reset role");
  }
  expect(await foundationSnapshot()).toEqual(beforeRows);
  foundationRowsPreserved=true;
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

type CaseView={caseId:string;workId:string;workVersion:number;revision:number;status:string;reason:string|null;basis:null|{evidence:{text:string}[]};assignment:null|{id:string};events:unknown[];outcome:string|null};
async function caseCommand(input:Record<string,unknown>,actor=WORKER,aal="aal2"){return (await run<{value:{caseId:string;revision:number}}>("select api.work_case_command($1::jsonb) value",[{idempotencyKey:crypto.randomUUID(),...input}],claims(actor,aal)))[0]!.value;}
async function caseRead(caseId:string,actor=WORKER,aal="aal2"){return (await run<{value:CaseView}>("select api.read_work_case($1::jsonb) value",[{caseId}],claims(actor,aal)))[0]!.value;}
const openInput=(c:{id:string;v:WorkVersion})=>({operation:"open",caseId:crypto.randomUUID(),...workExpected(c.id,c.v),reasonCode:"evidence_integrity",reason:"Synthetic concern requiring independent review"});
async function opened(){const c=await verified(),input=openInput(c);await caseCommand(input);return {...c,caseId:input.caseId};}
async function assign(caseId:string,reviewerId=REVIEWER){const v=await caseRead(caseId,OPERATOR);return caseCommand({operation:"assign",caseId,expectedRevision:v.revision,reviewerId,expiresAt:new Date(Date.now()+86400000).toISOString(),reason:"Independent synthetic assignment"},OPERATOR);}
async function accepted(){const c=await opened();await assign(c.caseId);const v=await caseRead(c.caseId,REVIEWER);await caseCommand({operation:"accept",caseId:c.caseId,expectedRevision:v.revision,noConflict:true},REVIEWER);return {...c,view:await caseRead(c.caseId,REVIEWER)};}
const resolution=(c:{caseId:string;view:CaseView},outcome="dismiss")=>({operation:"decide",caseId:c.caseId,expectedRevision:c.view.revision,outcome,rationale:"Synthetic independent review rationale"});
async function restoreReviewer(){await db.exec(`insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at) values('${REVIEWER}','reviewer','${OPERATOR}','Synthetic test renewal',now()+interval '1 day')`);}

describe("Day 7 denial-first work case review",()=>{
 it("preserves all pre-existing foundation rows across the six migrations",()=>{expect(foundationRowsPreserved).toBe(true);});
 it.each([0,1,2,3,4,5,6])("activation stage %i satisfies the read-only security assertions",stage=>{
  expect(activationStages).toContain(stage);
 });
 it("executes the prepared two-account command journey against persistent SQL",async()=>{
  const evidence:string[]=[];
  const result=await twoAccountFlow({worker:{id:WORKER},employer:{id:APPROVER},companyId:COMPANY,record:label=>evidence.push(label),request:async(actor,path,body,statuses=[200])=>{
   const url=new URL(path,"https://local-test.invalid");
   if(url.pathname==="/api/v1/passport"&&!body&&!passportReadRequestSchema.safeParse(url.searchParams.size?Object.fromEntries(url.searchParams):{cursor:null}).success){expect(statuses).toEqual([422]);return;}
   const rpc=body?({"/api/v1/offers":"review_offer","/api/v1/agreement-workflows":"agreement_workflow","/api/v1/work-records":"work_command","/api/v1/passport":"initialize_passport"} as Record<string,string>)[url.pathname]:({"/api/v1/agreements":"get_agreement","/api/v1/agreement-workflows":"read_agreement_workflow","/api/v1/work-records":"read_work","/api/v1/passport":"read_passport"} as Record<string,string>)[url.pathname];
   if(!rpc)throw new Error("Unmapped test transport");
   const payload=body??(url.searchParams.size?Object.fromEntries(url.searchParams):{cursor:null});
   try{const rows=await run<{value:unknown}>(`select api.${rpc}($1::jsonb) value`,[payload],claims(actor.id));expect(statuses).toEqual([200]);return rows[0]!.value;}
   catch(error){if(statuses.includes(403)){expect(String(error)).toContain("ACTION_FORBIDDEN");return;}throw error;}
  }});
  expect(result.workId).toMatch(/^[0-9a-f-]{36}$/);
  expect(evidence).toContain("Private worker Passport contains eligible verified record");
 });
 it.runIf(realPostgres)("assignment revocation commits before a waiting decision and denies it",async()=>{const c=await accepted(),revoker=await localPostgresConnection(true),reviewer=await localPostgresConnection(true);let pending:Promise<unknown>|undefined;try{await revoker.exec("begin;set local role authenticated");await revoker.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(OPERATOR))]);await revoker.query("select api.work_case_command($1::jsonb)",[{operation:"revoke",caseId:c.caseId,expectedRevision:c.view.revision,reason:"Concurrent assignment revocation",idempotencyKey:crypto.randomUUID()}]);await reviewer.exec("begin;set local role authenticated");await reviewer.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(REVIEWER))]);pending=reviewer.query("select api.work_case_command($1::jsonb)",[{...resolution(c),idempotencyKey:crypto.randomUUID()}]).then(()=>"committed",error=>error);let waiting=0;for(let i=0;i<100;i++){waiting=(await db.query<{n:number}>("select count(*)::int n from pg_locks where locktype='advisory' and not granted")).rows[0]!.n;if(waiting)break;await new Promise(resolve=>setTimeout(resolve,25));}expect(waiting).toBeGreaterThan(0);await revoker.exec("commit");expect(await pending).toBeInstanceOf(Error);await reviewer.exec("rollback");expect((await caseRead(c.caseId)).status).toBe("open");}finally{await revoker.exec("rollback").catch(()=>undefined);if(pending)await pending;await reviewer.exec("rollback").catch(()=>undefined);await Promise.all([revoker.close(),reviewer.close()]);}});
 it.runIf(realPostgres)("concurrent case opening and work verification cannot publish an open case",async()=>{const c=await submitted(),clients=await Promise.all([localPostgresConnection(true),localPostgresConnection(true)]);try{for(const [index,connection] of clients.entries()){await connection.exec("begin;set local role authenticated");await connection.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(index?APPROVER:WORKER))]);}const inputs=[openInput(c),{operation:"decide",...workExpected(c.id,c.v),outcome:"verified",reason:"Concurrent verification"}];const result=await Promise.allSettled(clients.map(async(connection,index)=>{try{await connection.query(`select api.${index?"work_command":"work_case_command"}($1::jsonb)`,[{...inputs[index],idempotencyKey:crypto.randomUUID()}]);await connection.exec("commit");}catch(error){await connection.exec("rollback");throw error;}}));expect(result.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(result.filter(r=>r.status==="rejected")).toHaveLength(1);await initialize();const cases=await run<{value:{items:unknown[]}}>("select api.list_work_cases($1::jsonb) value",[{cursor:null,workId:c.id}],claims(WORKER));if(cases[0]!.value.items.length)expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(false);}finally{await Promise.all(clients.map(c=>c.close()));}});
 it("enforces the typed transport schemas on real persisted reads and scoped listings",async()=>{const c=await accepted();expect(caseReadSchema.parse(await caseRead(c.caseId,REVIEWER)).basis?.evidence).toHaveLength(1);const rows=await run<{value:unknown}>("select api.list_work_cases($1::jsonb) value",[{cursor:null,workId:c.id}],claims(OTHER));expect(caseListSchema.parse(rows[0]!.value).items).toEqual([]);const allowed=await run<{value:unknown}>("select api.list_work_cases($1::jsonb) value",[{cursor:null,workId:c.id}],claims(WORKER));expect(caseListSchema.parse(allowed[0]!.value).items.map(x=>x.caseId)).toEqual([c.caseId]);expect(caseReceiptSchema.parse(await caseCommand(resolution(c),REVIEWER)).status).toBe("resolved");});
 it("reviewer refusal revokes evidence access atomically while preserving participant history",async()=>{const c=await opened();await assign(c.caseId);const view=await caseRead(c.caseId,REVIEWER);await caseCommand({operation:"accept",caseId:c.caseId,expectedRevision:view.revision,noConflict:false},REVIEWER);await expect(caseRead(c.caseId,REVIEWER)).rejects.toThrow("NOT_FOUND");const worker=caseReadSchema.parse(await caseRead(c.caseId));expect(worker.events.at(-1)?.operation).toBe("refuse");expect(worker.assignment?.revokedAt).not.toBeNull();expect(worker.status).toBe("open");await assign(c.caseId);});
 it("expired assignment denies reads and decisions without releasing suppression",async()=>{const c=await opened();await caseCommand({operation:"assign",caseId:c.caseId,expectedRevision:1,reviewerId:REVIEWER,expiresAt:new Date(Date.now()+2000).toISOString(),reason:"Short synthetic assignment"},OPERATOR);await new Promise(resolve=>setTimeout(resolve,2100));await expect(caseRead(c.caseId,REVIEWER)).rejects.toThrow("NOT_FOUND");await expect(caseCommand({operation:"accept",caseId:c.caseId,expectedRevision:2,noConflict:true},REVIEWER)).rejects.toThrow("NOT_FOUND");expect((await caseRead(c.caseId)).status).toBe("open");});
 it("denies direct client table access and immutable history changes, with a non-bypass executor",async()=>{const role=await db.query<{rolsuper:boolean;rolbypassrls:boolean;rolcanlogin:boolean}>("select rolsuper,rolbypassrls,rolcanlogin from pg_roles where rolname='fw_review_exec'");expect(role.rows).toEqual([{rolsuper:false,rolbypassrls:false,rolcanlogin:false}]);for(const table of ["work_cases","work_case_assignments","work_case_events","work_case_receipts","work_case_resolutions"]){await expect(run(`select * from private.${table}`)).rejects.toThrow();const policies=await db.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>("select relrowsecurity,relforcerowsecurity from pg_class where oid=$1::regclass",[`private.${table}`]);expect(policies.rows[0]).toEqual({relrowsecurity:true,relforcerowsecurity:true});}const c=await accepted();await caseCommand(resolution(c),REVIEWER);for(const table of ["work_case_events","work_case_receipts","work_case_resolutions"])await expect(db.exec(`delete from private.${table}`)).rejects.toThrow("ACTION_FORBIDDEN");});
 it("revoked operator capability denies assignment and metadata access",async()=>{const c=await opened();await db.query("update private.capability_assignments set revoked_at=clock_timestamp() where subject_id=$1 and capability='review_operator' and revoked_at is null",[OPERATOR]);try{await expect(caseRead(c.caseId,OPERATOR)).rejects.toThrow("NOT_FOUND");await expect(assign(c.caseId)).rejects.toThrow("NOT_FOUND");}finally{await db.exec(`insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at) values('${OPERATOR}','review_operator','${MEMBER}','Synthetic renewal',now()+interval '1 day')`);}});
 it("dismissal never restores retracted verification or a prior upheld exact version",async()=>{const c=await accepted();await initialize();await integrity({operation:"retract",...workExpected(c.id,c.v),reason:"Verification withdrawn"},APPROVER);await caseCommand(resolution(c),REVIEWER);expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(false);const second=await accepted();await caseCommand(resolution(second,"uphold"),REVIEWER);const fresh=openInput(second);await caseCommand(fresh);await assign(fresh.caseId);const meta=await caseRead(fresh.caseId,REVIEWER);await caseCommand({operation:"accept",caseId:fresh.caseId,expectedRevision:meta.revision,noConflict:true},REVIEWER);await caseCommand(resolution({caseId:fresh.caseId,view:await caseRead(fresh.caseId,REVIEWER)}),REVIEWER);expect((await passport()).entries.some(e=>e.workId===second.id)).toBe(false);});
 it.runIf(realPostgres)("committed capability revocation denies a waiting reviewer decision",async()=>{const c=await accepted(),revoker=await localPostgresConnection(true),reviewer=await localPostgresConnection(true);let pending:Promise<unknown>|undefined;try{await revoker.exec("begin");await revoker.query("update private.capability_assignments set revoked_at=clock_timestamp() where subject_id=$1 and capability='reviewer' and revoked_at is null",[REVIEWER]);await reviewer.exec("begin;set local role authenticated");await reviewer.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(REVIEWER))]);pending=reviewer.query("select api.work_case_command($1::jsonb)",[{...resolution(c),idempotencyKey:crypto.randomUUID()}]).then(()=>"committed",error=>error);let waiting=0;for(let i=0;i<100;i++){waiting=(await db.query<{n:number}>("select count(*)::int n from pg_locks where not granted")).rows[0]!.n;if(waiting)break;await new Promise(resolve=>setTimeout(resolve,25));}expect(waiting).toBeGreaterThan(0);await revoker.exec("commit");expect(await pending).toBeInstanceOf(Error);await reviewer.exec("rollback");expect((await caseRead(c.caseId)).status).toBe("open");}finally{await revoker.exec("rollback").catch(()=>undefined);if(pending)await pending;await reviewer.exec("rollback").catch(()=>undefined);await Promise.all([revoker.close(),reviewer.close()]);await restoreReviewer();}});
 it.runIf(realPostgres)("case history survives a fresh connection and duplicate concurrent opens write once",async()=>{const c=await verified(),input={...openInput(c),idempotencyKey:crypto.randomUUID()},clients=await Promise.all([localPostgresConnection(true),localPostgresConnection(true)]);try{for(const connection of clients){await connection.exec("begin;set local role authenticated");await connection.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(WORKER))]);}const values=await Promise.all(clients.map(async connection=>{const rows=await connection.query<{value:unknown}>("select api.work_case_command($1::jsonb) value",[input]);await connection.exec("commit");return rows.rows[0]!.value;}));expect(values[0]).toEqual(values[1]);await clients[0]!.exec("begin;set local role authenticated");await clients[0]!.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(WORKER))]);const reopened=await clients[0]!.query<{value:unknown}>("select api.read_work_case($1::jsonb) value",[{caseId:input.caseId}]);expect(caseReadSchema.parse(reopened.rows[0]!.value).events).toHaveLength(1);await clients[0]!.exec("commit");}finally{await Promise.all(clients.map(c=>c.close()));}});
 it("denies unauthenticated and forged reporter/authority inputs",async()=>{await expect(run("select api.work_case_command('{}'::jsonb)",[],{})).rejects.toThrow("AUTH_REQUIRED");const c=await verified();for(const extra of [{reporterId:OTHER},{reviewerId:REVIEWER},{status:"resolved"},{companyId:COMPANY}])await expect(caseCommand({...openInput(c),...extra})).rejects.toThrow("VALIDATION_FAILED");});
 it("denies foreign reporters, private drafts and stale work revisions",async()=>{const c=await verified();await expect(caseCommand(openInput(c),OTHER)).rejects.toThrow("NOT_FOUND");await expect(caseCommand({...openInput(c),expectedVersion:99})).rejects.toThrow("VERSION_CONFLICT");await expect(caseCommand(openInput(await created()))).rejects.toThrow("ACTION_FORBIDDEN");});
 it("suppresses Passport immediately, replays once and rejects changed duplicates",async()=>{const c=await verified();await initialize();expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(true);const input={...openInput(c),idempotencyKey:crypto.randomUUID()};const receipt=await caseCommand(input);expect(await caseCommand(input)).toEqual(receipt);await expect(caseCommand({...input,reason:"Changed"})).rejects.toThrow("IDEMPOTENCY_CONFLICT");await expect(caseCommand(openInput(c))).rejects.toThrow("VERSION_CONFLICT");expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(false);expect((await db.query<{n:number}>("select count(*)::int n from private.audit_logs where request_id=$1",[input.idempotencyKey])).rows[0]!.n).toBe(1);});
 it("denies cross-tenant reads and gives operators no raw evidence",async()=>{const c=await opened();await expect(caseRead(c.caseId,OTHER)).rejects.toThrow("NOT_FOUND");await expect(caseRead(c.caseId,REVIEWER)).rejects.toThrow("NOT_FOUND");const meta=await caseRead(c.caseId,OPERATOR);expect(meta.basis).toBeNull();expect(meta.reason).toBeNull();expect(meta.events).toEqual([]);});
 it("denies unauthorized, self and conflicted assignments and requires MFA",async()=>{const c=await opened();const input={operation:"assign",caseId:c.caseId,expectedRevision:1,reviewerId:REVIEWER,expiresAt:new Date(Date.now()+86400000).toISOString(),reason:"Assign"};await expect(caseCommand(input,WORKER)).rejects.toThrow("ACTION_FORBIDDEN");await expect(caseCommand(input,OPERATOR,"aal1")).rejects.toThrow("MFA_REQUIRED");for(const reviewerId of [WORKER,APPROVER,MEMBER,OPERATOR])await expect(caseCommand({...input,reviewerId},OPERATOR)).rejects.toThrow("ACTION_FORBIDDEN");});
 it("requires explicit acceptance before evidence or decisions and denies direct unrelated evidence reads",async()=>{const c=await opened();await assign(c.caseId);const meta=await caseRead(c.caseId,REVIEWER);expect(meta.basis).toBeNull();await expect(caseCommand({operation:"decide",caseId:c.caseId,expectedRevision:meta.revision,outcome:"dismiss",rationale:"Unaccepted"},REVIEWER)).rejects.toThrow("ACTION_FORBIDDEN");await caseCommand({operation:"accept",caseId:c.caseId,expectedRevision:meta.revision,noConflict:true},REVIEWER);expect((await caseRead(c.caseId,REVIEWER)).basis?.evidence[0]?.text).toBe(payload.evidence[0]);await expect(workRead(c.id,REVIEWER)).rejects.toThrow("NOT_FOUND");await expect(run("select api.read_work_evidence($1::jsonb)",[{evidenceId:c.v.content.evidence[0]!.id}],claims(REVIEWER))).rejects.toThrow("NOT_FOUND");});
 it("denies worker, operator and MFA-deficient reviewer decisions",async()=>{const c=await accepted();for(const actor of [WORKER,OPERATOR,OTHER])await expect(caseCommand(resolution(c),actor)).rejects.toThrow();await expect(caseCommand(resolution(c),REVIEWER,"aal1")).rejects.toThrow("MFA_REQUIRED");});
 it("revoked reviewer capability denies evidence and decisions",async()=>{const c=await accepted();await db.query("update private.capability_assignments set revoked_at=clock_timestamp() where subject_id=$1 and capability='reviewer' and revoked_at is null",[REVIEWER]);try{await expect(caseRead(c.caseId,REVIEWER)).rejects.toThrow("NOT_FOUND");await expect(caseCommand(resolution(c),REVIEWER)).rejects.toThrow();}finally{await restoreReviewer();}});
 it("revoked assignment denies former reviewer and retains the unresolved suppression",async()=>{const c=await accepted();await caseCommand({operation:"revoke",caseId:c.caseId,expectedRevision:c.view.revision,reason:"Assignment withdrawn"},OPERATOR);await expect(caseRead(c.caseId,REVIEWER)).rejects.toThrow("NOT_FOUND");await expect(caseCommand(resolution(c),REVIEWER)).rejects.toThrow();await initialize();expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(false);});
 it("dismissal restores only otherwise eligible work and preserves immutable decisions",async()=>{const c=await accepted();await initialize();const input={...resolution(c),idempotencyKey:crypto.randomUUID()};const receipt=await caseCommand(input,REVIEWER);expect(await caseCommand(input,REVIEWER)).toEqual(receipt);expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(true);await expect(caseCommand({...input,outcome:"uphold",idempotencyKey:crypto.randomUUID()},REVIEWER)).rejects.toThrow("VERSION_CONFLICT");await expect(db.exec("update private.work_case_resolutions set rationale='rewrite'")).rejects.toThrow("ACTION_FORBIDDEN");});
 it("dismissal cannot resurrect withdrawn work and upheld versions stay suppressed",async()=>{for(const outcome of ["dismiss","uphold","correction_required"]){const c=await accepted();await initialize();if(outcome==="dismiss")await integrity(withdraw(c));await caseCommand(resolution(c,outcome),REVIEWER);expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(false);}});
 it("corrections cannot bypass an unresolved case or reuse historical verification",async()=>{const c=await accepted();await initialize();await integrity(correct(c));const v=(await workRead(c.id)).versions.at(-1)!;await work({operation:"submit",...workExpected(c.id,v)});const submitted=(await workRead(c.id)).versions.at(-1)!;await expect(work({operation:"decide",...workExpected(c.id,submitted),outcome:"verified",reason:"Bypass"},APPROVER)).rejects.toThrow("ACTION_FORBIDDEN");expect((await passport()).entries.some(e=>e.workId===c.id)).toBe(false);await caseCommand(resolution(c,"correction_required"),REVIEWER);await work({operation:"decide",...workExpected(c.id,submitted),outcome:"verified",reason:"Fresh independent review"},APPROVER);expect((await passport()).entries.find(e=>e.workId===c.id)?.version).toBe(2);});
 it("revoked representative cannot report or read while worker keeps case access",async()=>{const c=await opened();await membership("revoke");try{await expect(caseRead(c.caseId,APPROVER)).rejects.toThrow("NOT_FOUND");await expect(caseCommand(openInput(c),APPROVER)).rejects.toThrow("NOT_FOUND");expect((await caseRead(c.caseId)).caseId).toBe(c.caseId);}finally{await membership("approve");}});
 it.runIf(realPostgres)("concurrent conflicting reviewer decisions commit exactly once",async()=>{const c=await accepted(),clients=await Promise.all([localPostgresConnection(true),localPostgresConnection(true)]);try{for(const connection of clients){await connection.exec("begin;set local role authenticated");await connection.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(REVIEWER))]);}const results=await Promise.allSettled(clients.map(async(connection,i)=>{try{const value=await connection.query("select api.work_case_command($1::jsonb)",[{...resolution(c,i?"uphold":"dismiss"),idempotencyKey:crypto.randomUUID()}]);await connection.exec("commit");return value;}catch(e){await connection.exec("rollback");throw e;}}));expect(results.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(results.filter(r=>r.status==="rejected")).toHaveLength(1);}finally{await Promise.all(clients.map(c=>c.close()));}});
});

