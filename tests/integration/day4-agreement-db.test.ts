import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
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
    await runMigration(await readFile("supabase/migrations/202610140001_versioned_agreements.sql", "utf8"));
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
  const input = { offerId: crypto.randomUUID(), companyId: COMPANY, workerId: WORKER, requesterRole: "WORKER", terms: { salary: 120000, currency: "LKR", startDate: "2026-10-23", hoursPerWeek: 40, responsibilities: "Engineering" }, expectedVersion: 1, idempotencyKey: crypto.randomUUID(), ...overrides };
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

describe("Day 4 restricted-role agreement contract", () => {
  it("passes the nine read-only Day 4 catalog assertions",async()=>{
    const result=await db.query<{name:string;result:string}>(await readFile("scripts/day4-catalog.sql","utf8"));
    expect(result.rows).toHaveLength(9);expect(result.rows.filter(row=>row.result!=="PASS")).toEqual([]);
  });
  it("freezes source, derives participants, hides draft and preserves the legacy private-source boundary", async () => {
    const {id,view,offer}=await draft();
    expect(view.versions[0]!.status).toBe("ready_for_review");
    expect(view.versions[0]!.unresolvedIds.length).toBeGreaterThan(0);
    await expect(read(id,APPROVER)).rejects.toThrow("NOT_FOUND");
    await propose(id);
    expect((await read(id,APPROVER)).versions).toHaveLength(1);
    await expect(run("select api.get_agreement($1::jsonb)",[{offerId:offer.offerId}],claims(APPROVER))).rejects.toThrow("NOT_FOUND");
    await expect(read(id,OTHER)).rejects.toThrow("NOT_FOUND");
    await expect(read(id,MEMBER)).rejects.toThrow("NOT_FOUND");
  });
  it("requires exact independent acknowledgements before dual confirmation and records receipts/audit once",async()=>{
    await clearQuotas();
    const {id,input}=await draft();
    const v=await propose(id);
    const base=acknowledgement(id,v);
    await expect(command({operation:"acknowledge",...base,acknowledgedItemIds:[]})).rejects.toThrow("VALIDATION_FAILED");
    await expect(command({operation:"acknowledge",...base,acknowledgedItemIds:[...v.unresolvedIds,v.unresolvedIds[0]]})).rejects.toThrow("VALIDATION_FAILED");
    await expect(command({operation:"acknowledge",...base,actorId:APPROVER})).rejects.toThrow("VALIDATION_FAILED");
    await expect(command({operation:"decide",...base,decision:"confirm"})).rejects.toThrow("ACTION_FORBIDDEN");
    const ack={operation:"acknowledge",...base,idempotencyKey:crypto.randomUUID()};
    const receipt=await command(ack);
    expect(await command(ack)).toEqual(receipt);
    await expect(command({...ack,expectedHash:"0".repeat(64)})).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await command({operation:"decide",...base,decision:"confirm"});
    expect((await read(id)).effectiveVersion).toBeNull();
    await expect(command({operation:"acknowledge",...base},MEMBER)).rejects.toThrow("NOT_FOUND");
    await command({operation:"acknowledge",...base},APPROVER);
    await command({operation:"decide",...base,decision:"confirm"},APPROVER);
    const final=await read(id,APPROVER);
    expect(final.effectiveVersion).toBe(1);
    expect(final.versions[0]!.status).toBe("effective");
    expect(final.versions[0]!.decisions).toHaveLength(2);
    expect(await command(input)).toMatchObject({operation:"create",version:1,state:"draft"});
    const audit=await db.query<{count:number}>("select count(*)::int count from private.audit_logs where request_id=$1",[ack.idempotencyKey]);
    expect(audit.rows[0]!.count).toBe(1);
  });
  it("rejects self/foreign representative and forged company and hash input",async()=>{
    await clearQuotas(); const {input}=await draft();
    for(const representativeId of [WORKER,OTHER]) await expect(command({...input,agreementId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),representativeId})).rejects.toThrow("ACTION_FORBIDDEN");
    await expect(command({...input,companyId:COMPANY})).rejects.toThrow("VALIDATION_FAILED");
    await expect(command({...input,agreementId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),expectedSourceHash:"0".repeat(64)})).rejects.toThrow("VERSION_CONFLICT");
  });
  it("keeps effective history during amendment and requires fresh exact consent",async()=>{
    await clearQuotas(); const {id,offer}=await draft(); const v=await propose(id);
    for(const actor of [WORKER,APPROVER]) {await command({operation:"acknowledge",...acknowledgement(id,v)},actor);await command({operation:"decide",...acknowledgement(id,v),decision:"confirm"},actor);}
    const confirmed=(await read(id)).versions[0]!;
    const next=await source({offerId:offer.offerId,expectedVersion:2,terms:{...offer.terms,salary:150000}});
    await command({operation:"amend",...expected(id,confirmed),offerId:next.offerId,offerVersion:2,expectedSourceHash:next.termHash});
    expect((await read(id)).effectiveVersion).toBe(1);
    expect((await read(id,APPROVER)).versions).toHaveLength(1);
    const nextV=await propose(id);
    await expect(command({operation:"acknowledge",...acknowledgement(id,v)})).rejects.toThrow("VERSION_CONFLICT");
    await expect(command({operation:"acknowledge",...acknowledgement(id,nextV),acknowledgedItemIds:v.unresolvedIds})).rejects.toThrow("VALIDATION_FAILED");
    for(const actor of [WORKER,APPROVER]) {await command({operation:"acknowledge",...acknowledgement(id,nextV)},actor);await command({operation:"decide",...acknowledgement(id,nextV),decision:"confirm"},actor);}
    const final=await read(id); expect(final.effectiveVersion).toBe(2);expect(final.versions[0]!.state).toBe("superseded");
  });
  it("blocks missing answers and detects new immutable answer context",async()=>{
    await clearQuotas(); const offer=await source({terms:{salary:120000}}); const id=crypto.randomUUID();
    await command({operation:"create",agreementId:id,offerId:offer.offerId,offerVersion:1,expectedSourceHash:offer.termHash,representativeId:APPROVER});
    const old=(await read(id)).versions[0]!; expect(old.status).toBe("awaiting_answers");
    await expect(propose(id)).rejects.toThrow("VALIDATION_FAILED");
    for(const q of offer.unresolved) await run("select api.answer_offer_question($1::jsonb)",[{offerId:offer.offerId,offerVersion:1,questionId:q.id,answer:"Recorded clarification only",idempotencyKey:crypto.randomUUID()}],claims(WORKER));
    expect((await read(id)).versions[0]!.status).toBe("revision_conflict");
    await expect(propose(id)).rejects.toThrow("VERSION_CONFLICT");
    await command({operation:"amend",...expected(id,old),offerId:offer.offerId,offerVersion:1,expectedSourceHash:offer.termHash});
    const v=await propose(id);expect(v.content.answers).toHaveLength(offer.unresolved.length);
    expect(v.unresolvedIds.length).toBeGreaterThan(offer.unresolved.length);
  });
  it("makes decline terminal and denies expired/anonymous sessions and client table access",async()=>{
    await clearQuotas(); const {id}=await draft();const v=await propose(id);
    await command({operation:"decide",...acknowledgement(id,v),decision:"decline"},APPROVER);
    expect((await read(id)).versions[0]!.status).toBe("declined");
    await expect(command({operation:"acknowledge",...acknowledgement(id,v)})).rejects.toThrow("VERSION_CONFLICT");
    await expect(run("select api.read_agreement_workflow($1::jsonb)",[{agreementId:id}],{...claims(WORKER),is_anonymous:true})).rejects.toThrow("AUTH_REQUIRED");
    await expect(run("select * from private.agreement_versions",[],claims(WORKER))).rejects.toThrow();
    const catalog=await db.query<{name:string;forced:boolean}>("select relname name,relforcerowsecurity forced from pg_class where relname in ('agreement_roots','agreement_versions','agreement_acknowledgements','agreement_decisions','agreement_receipts')");
    expect(catalog.rows).toHaveLength(5);expect(catalog.rows.every(row=>row.forced)).toBe(true);
  });
  it("enforces revocation/reapproval without transferring representative consent",async()=>{
    await clearQuotas();const {id}=await draft();const v=await propose(id);
    await command({operation:"acknowledge",...acknowledgement(id,v)},APPROVER);
    const change=(decision:string,expectedRevision:number,aal="aal2")=>run("select api.decide_membership($1::jsonb)",[{companyId:COMPANY,subjectId:APPROVER,decision,expectedRevision,expiresAt:decision==="revoke"?null:new Date(Date.now()+86400000).toISOString(),reviewedEvidenceRefs:["demo:fixture/day4"],reason:"Synthetic Day 4 revocation/reapproval",policyVersion:"demo-authority.v1",idempotencyKey:crypto.randomUUID()}],claims(MEMBER,aal));
    await expect(change("revoke",1,"aal1")).rejects.toThrow("MFA_REQUIRED");
    await change("revoke",1);
    await expect(read(id,APPROVER)).rejects.toThrow("NOT_FOUND");
    await expect(command({operation:"decide",...acknowledgement(id,v),decision:"confirm"})).rejects.toThrow("ACTION_FORBIDDEN");
    await change("approve",2);
    expect((await read(id)).versions[0]!.status).toBe("revision_conflict");
    await expect(command({operation:"decide",...acknowledgement(id,v),decision:"confirm"},APPROVER)).rejects.toThrow("VERSION_CONFLICT");
  });
  it("blocks suspended participants and immutable history edits and has only narrow RPC grants",async()=>{
    await clearQuotas();const {id}=await draft();await propose(id);
    await db.query("update private.profiles set account_state='suspended' where id=$1",[WORKER]);
    try {await expect(read(id,APPROVER)).rejects.toThrow("NOT_FOUND");await expect(read(id)).rejects.toThrow("AUTH_REQUIRED");}
    finally{await db.query("update private.profiles set account_state='active' where id=$1",[WORKER]);}
    await expect(db.query("update private.agreement_versions set content='{}' where agreement_id=$1",[id])).rejects.toThrow("ACTION_FORBIDDEN");
    const catalog=await db.query<{name:string;owner:string;secure:boolean;path:string[];allowed:boolean;anon:boolean;service:boolean}>("select p.proname name,r.rolname owner,p.prosecdef secure,p.proconfig path,has_function_privilege('authenticated',p.oid,'EXECUTE') allowed,has_function_privilege('anon',p.oid,'EXECUTE') anon,has_function_privilege('service_role',p.oid,'EXECUTE') service from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='api' and p.proname in ('agreement_workflow','read_agreement_workflow')");
    expect(catalog.rows).toHaveLength(2);for(const row of catalog.rows)expect(row).toMatchObject({owner:"fw_user_exec",secure:true,path:['search_path=""'],allowed:true,anon:false,service:false});
  });
  it("denies a representative approved only for another company and substituted answer/source input",async()=>{
    await clearQuotas();
    const company=(await run<{value:{id:string}}>("select api.provision_company($1::jsonb) value",[{name:"Synthetic unrelated company",idempotencyKey:crypto.randomUUID()}],claims(MEMBER)))[0]!.value.id;
    await run("select api.decide_membership($1::jsonb)",[{companyId:company,subjectId:OTHER,decision:"approve",expectedRevision:0,expiresAt:new Date(Date.now()+86400000).toISOString(),reviewedEvidenceRefs:["demo:fixture/day4"],reason:"Separate company fixture",policyVersion:"demo-authority.v1",idempotencyKey:crypto.randomUUID()}],claims(MEMBER));
    const {input,id}=await draft();
    await expect(command({...input,agreementId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),representativeId:OTHER})).rejects.toThrow("ACTION_FORBIDDEN");
    await expect(command({...input,answerRefs:[crypto.randomUUID()]})).rejects.toThrow("VALIDATION_FAILED");
    const v=await propose(id);
    await expect(command({operation:"amend",...expected(id,v),offerId:crypto.randomUUID(),offerVersion:1,expectedSourceHash:"0".repeat(64)})).rejects.toThrow("VALIDATION_FAILED");
    await expect(read(id,OTHER)).rejects.toThrow("NOT_FOUND");
  });
  it("reauthorizes expiry, empty-set consent and source freshness independently of client flags",async()=>{
    await clearQuotas();
    const full=await source({terms:{salary:1,currency:"LKR",salaryPeriod:"month",salaryBasis:"gross",hoursPerWeek:1,overtime:"None agreed",paymentSchedule:"Monthly",responsibilities:"Engineering",employmentType:"contract",location:"Colombo",startDate:"2026-10-23",endDate:"2026-11-23",duration:"1 month",benefits:"None agreed",deductions:"None agreed",termination:"Seven days",otherConditions:"None agreed"}});
    const id=crypto.randomUUID();await command({operation:"create",agreementId:id,offerId:full.offerId,offerVersion:1,expectedSourceHash:full.termHash,representativeId:APPROVER});const v=await propose(id);expect(v.unresolvedIds).toEqual([]);
    await command({operation:"acknowledge",...acknowledgement(id,v)});
    await expect(command({operation:"acknowledge",...acknowledgement(id,v),acknowledgedItemIds:[crypto.randomUUID()]},APPROVER)).rejects.toThrow("VALIDATION_FAILED");
    const change=(expectedRevision:number,expiresAt:string)=>run("select api.decide_membership($1::jsonb)",[{companyId:COMPANY,subjectId:APPROVER,decision:"approve",expectedRevision,expiresAt,reviewedEvidenceRefs:["demo:fixture/day4"],reason:"Expiry test",policyVersion:"demo-authority.v1",idempotencyKey:crypto.randomUUID()}],claims(MEMBER));
    await change(3,new Date(Date.now()+2000).toISOString());
    await new Promise(resolve=>setTimeout(resolve,2100));
    try {await expect(read(id,APPROVER)).rejects.toThrow("NOT_FOUND");await expect(command({operation:"decide",...acknowledgement(id,v),decision:"confirm"})).rejects.toThrow("ACTION_FORBIDDEN");}
    finally{await change(4,new Date(Date.now()+86400000).toISOString());}
  });
  it.skipIf(!realPostgres)("serializes actual concurrent PostgreSQL acknowledgements/confirmations and rejects amendment races",async()=>{
    await clearQuotas();const {id}=await draft();const v=await propose(id);
    async function separate(input:Record<string,unknown>,actor:string) {
      const connection=await localPostgresConnection(true);
      try {await connection.exec("begin; set local role authenticated");await connection.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(actor))]);
        const result=await connection.query("select api.agreement_workflow($1::jsonb) value",[{idempotencyKey:crypto.randomUUID(),...input}]);await connection.exec("commit");return result.rows[0];
      }catch(error){await connection.exec("rollback");throw error;}finally{await connection.close();}
    }
    async function race(inputs:Array<{input:Record<string,unknown>;actor:string}>) {
      await db.exec("begin");await db.query("select pg_advisory_xact_lock(hashtextextended($1,4))",[id]);
      const pending=Promise.allSettled(inputs.map(({input,actor})=>separate(input,actor)));
      let waiting=0;
      try {for(let attempt=0;attempt<100;attempt++){
        const state=await db.query<{count:number}>("select count(*)::int count from pg_locks where locktype='advisory' and not granted and pid<>pg_backend_pid()");waiting=state.rows[0]!.count;if(waiting===inputs.length)break;await new Promise(resolve=>setTimeout(resolve,25));
      }}finally{await db.exec("commit");}
      const results=await pending;expect(waiting).toBe(inputs.length);return results;
    }
    const acknowledgements=await race([WORKER,APPROVER].map(actor=>({actor,input:{operation:"acknowledge",...acknowledgement(id,v)}})));
    expect(acknowledgements.map(r=>r.status)).toEqual(["fulfilled","fulfilled"]);
    const confirmations=await race([WORKER,APPROVER].map(actor=>({actor,input:{operation:"decide",...acknowledgement(id,v),decision:"confirm"}})));
    expect(confirmations.map(r=>r.status)).toEqual(["fulfilled","fulfilled"]);
    const final=await read(id);expect(final.effectiveVersion).toBe(1);expect(final.versions[0]!.decisions).toHaveLength(2);
    const receipts=await db.query<{count:number}>("select count(*)::int count from private.agreement_decisions where agreement_id=$1",[id]);expect(receipts.rows[0]!.count).toBe(2);
    const expectedCurrent=expected(id,final.versions[0]!);
    const sourceState=(await run<{value:{offer:{version:number;termHash:string}}}>("select api.get_agreement($1::jsonb) value",[{offerId:(await db.query<{offer_id:string}>("select offer_id from private.agreement_roots where id=$1",[id])).rows[0]!.offer_id}],claims(WORKER)))[0]!.value.offer;
    const offerId=(await db.query<{offer_id:string}>("select offer_id from private.agreement_roots where id=$1",[id])).rows[0]!.offer_id;
    const amend={operation:"amend",...expectedCurrent,offerId,offerVersion:sourceState.version,expectedSourceHash:sourceState.termHash};
    const amendments=await race([{actor:WORKER,input:amend},{actor:WORKER,input:amend}]);
    expect(amendments.filter(r=>r.status==="fulfilled")).toHaveLength(1);expect(amendments.filter(r=>r.status==="rejected")).toHaveLength(1);
    expect((await read(id)).effectiveVersion).toBe(1);expect((await read(id)).currentVersion).toBe(2);
  });
  it.skipIf(!realPostgres)("revocation committed while confirmation waits prevents an effective agreement",async()=>{
    await clearQuotas();const {id}=await draft();const v=await propose(id);
    for(const actor of [WORKER,APPROVER])await command({operation:"acknowledge",...acknowledgement(id,v)},actor);
    await command({operation:"decide",...acknowledgement(id,v),decision:"confirm"});
    const revoker=await localPostgresConnection(true),confirmer=await localPostgresConnection(true);
    try {
      await revoker.exec("begin; set local role authenticated");await revoker.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(MEMBER))]);
      await revoker.query("select api.decide_membership($1::jsonb)",[{companyId:COMPANY,subjectId:APPROVER,decision:"revoke",expectedRevision:5,expiresAt:null,reviewedEvidenceRefs:["demo:fixture/day4"],reason:"Concurrent revocation",policyVersion:"demo-authority.v1",idempotencyKey:crypto.randomUUID()}]);
      await confirmer.exec("begin; set local role authenticated");await confirmer.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims(APPROVER))]);
      const pending=confirmer.query("select api.agreement_workflow($1::jsonb)",[{operation:"decide",...acknowledgement(id,v),decision:"confirm",idempotencyKey:crypto.randomUUID()}]).then(()=>({accepted:true,error:""}),error=>({accepted:false,error:String(error)}));
      let waiting=0;for(let attempt=0;attempt<100;attempt++){waiting=(await db.query<{count:number}>("select count(*)::int count from pg_locks where locktype='advisory' and not granted")).rows[0]!.count;if(waiting)break;await new Promise(resolve=>setTimeout(resolve,25));}
      await revoker.exec("commit");const result=await pending;expect(waiting).toBe(1);expect(result.accepted).toBe(false);expect(result.error).toContain("ACTION_FORBIDDEN");await confirmer.exec("rollback");
      expect((await read(id)).effectiveVersion).toBeNull();
      expect((await db.query<{count:number}>("select count(*)::int count from private.agreement_decisions where agreement_id=$1",[id])).rows[0]!.count).toBe(1);
    }finally{await revoker.exec("rollback");await confirmer.exec("rollback");await revoker.close();await confirmer.close();}
  });
});

