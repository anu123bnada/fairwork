import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const db = new PGlite();
const A = "40000000-0000-4000-8000-000000000001";
const B = "40000000-0000-4000-8000-000000000002";
const C = "40000000-0000-4000-8000-000000000003";
const claims = (id = A, aal = "aal2") => ({ sub: id, role: "authenticated", aal, is_anonymous: false });
async function run(sql: string, params: unknown[] = [], jwt = claims(), role = "authenticated") {
  await db.exec(`begin; set local role ${role}`);
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(jwt)]);
    const result = await db.query(sql, params);
    await db.exec("commit"); return result.rows;
  } catch (error) { await db.exec("rollback"); throw error; }
}
async function rpc(name: "provision_company" | "decide_membership", input: unknown, jwt = claims()) {
  const rows = await run(`select api.${name}($1::jsonb) as value`, [JSON.stringify(input)], jwt);
  return (rows[0] as { value: Record<string, unknown> }).value;
}
let company: string;
let approval: Record<string, unknown>;
const provision = { name: "Synthetic FAIRWORK company", idempotencyKey: crypto.randomUUID() };
const approve = (overrides = {}) => ({ companyId: company, subjectId: B, decision: "approve", expectedRevision: 0, expiresAt: new Date(Date.now() + 86400000).toISOString(), reviewedEvidenceRefs: ["demo:fixture/representative"], reason: "Synthetic rehearsal only", policyVersion: "demo-authority.v1", idempotencyKey: crypto.randomUUID(), ...overrides });
beforeAll(async () => {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    grant usage on schema auth to anon,authenticated,service_role;
    insert into auth.users values('${A}'),('${B}'),('${C}');`);
  for (const name of ["202610070001_identity_foundation", "202610080002_identity_auth_context", "202610090001_identity_rpc_execute"]) {
    await db.exec(await readFile(`supabase/migrations/${name}.sql`, "utf8"));
  }
  for (const id of [A,B,C]) await run("select api.create_profile($1)", [JSON.stringify({ displayName: "Synthetic", locale: "en", timeZone: "UTC", idempotencyKey: crypto.randomUUID() })], claims(id));
  await db.exec(`create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key);
    insert into supabase_migrations.schema_migrations values('202610070001'),('202610080002'),('202610090001');
    insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at) values('${A}','authority_operator','${C}','Local synthetic fixture',now()+interval '1 day');
    revoke usage on schema auth from fw_user_exec,fw_policy_exec;
    create role fixture_root superuser; create role managed_auth_owner nologin;
    alter schema auth owner to managed_auth_owner;
    grant usage on schema auth to postgres;
    set session authorization fixture_root;
    alter role postgres rename to fixture_bootstrap;
    create role postgres login inherit nosuperuser nobypassrls createrole;
    grant fw_schema_owner,fw_user_exec,fw_policy_exec to postgres;
    grant usage on schema auth to postgres;
    grant create on schema private to postgres;
    alter function private.request_uid() owner to postgres;
    alter function private.request_jwt() owner to postgres;
    grant usage on schema supabase_migrations to postgres;
    grant select on supabase_migrations.schema_migrations to postgres;
    set role postgres;`);
  try {
    const preflight=await db.exec(await readFile("scripts/day2-preflight.sql","utf8"));
    const checks=preflight.flatMap(result=>result.rows) as {result:string}[];
    expect(checks).toHaveLength(10);expect(checks.filter(check=>check.result!=="PASS")).toEqual([]);
    await db.exec(await readFile("supabase/migrations/202610090002_demo_authority.sql", "utf8"));
  }
  finally { await db.exec("reset role"); }
  await db.exec("insert into supabase_migrations.schema_migrations values('202610090002')");
});
afterAll(async () => { await db.close(); });

describe("Day 2 immutable synthetic authority", () => {
  it("preserves fresh profile creation, reads and updates after the Day 2 migration",async()=>{
    const fresh="40000000-0000-4000-8000-000000000004";
    await db.exec(`insert into auth.users values('${fresh}')`);
    const input={displayName:"Fresh synthetic",locale:"en",timeZone:"UTC",idempotencyKey:crypto.randomUUID()};
    expect(await run("select api.create_profile($1)->>'revision' as revision",[JSON.stringify(input)],claims(fresh,"aal1"))).toEqual([{revision:"1"}]);
    expect(await run("select api.get_me('{}')->>'id' as id",[],claims(fresh,"aal1"))).toEqual([{id:fresh}]);
    expect(await run("select api.update_profile($1)->>'revision' as revision",[JSON.stringify({...input,displayName:"Updated synthetic",expectedRevision:1,idempotencyKey:crypto.randomUUID()})],claims(fresh,"aal1"))).toEqual([{revision:"2"}]);
  });
  it("requires MFA and the protected capability; caller-supplied roles do not help", async () => {
    await expect(rpc("provision_company", provision, claims(A,"aal1"))).rejects.toMatchObject({message:"MFA_REQUIRED"});
    await expect(rpc("provision_company", provision, claims(B))).rejects.toMatchObject({message:"ACTION_FORBIDDEN"});
    await expect(rpc("provision_company", {...provision, actorId:B})).rejects.toMatchObject({message:"VALIDATION_FAILED"});
    await expect(rpc("provision_company", provision, {...claims(), is_anonymous:true})).rejects.toMatchObject({message:"AUTH_REQUIRED"});
  });
  it("provisions a visibly synthetic company once, without granting membership", async () => {
    const result = await rpc("provision_company", provision); company = result.id as string;
    expect(result).toMatchObject({name:provision.name,identityLabel:"demo_provisioned",revision:1});
    expect(await rpc("provision_company", provision)).toEqual(result);
    expect((await db.query("select count(*)::int as n from private.company_memberships")).rows).toEqual([{n:0}]);
    await expect(rpc("provision_company", {...provision,name:"Changed"})).rejects.toMatchObject({message:"IDEMPOTENCY_CONFLICT"});
  });
  it("rejects self approval, malformed direct RPC input, missing subjects and stale revisions", async () => {
    await expect(rpc("decide_membership",approve({subjectId:A}))).rejects.toMatchObject({message:"ACTION_FORBIDDEN"});
    await expect(rpc("decide_membership",approve({expectedRevision:1}))).rejects.toMatchObject({message:"VERSION_CONFLICT"});
    await expect(rpc("decide_membership",approve({reviewedEvidenceRefs:["https://private.example/evidence"]}))).rejects.toMatchObject({message:"VALIDATION_FAILED"});
    await expect(rpc("decide_membership",approve({subjectId:crypto.randomUUID()}))).rejects.toMatchObject({message:"NOT_FOUND"});
    await expect(rpc("decide_membership",approve({expiresAt:null}))).rejects.toMatchObject({message:"VALIDATION_FAILED"});
  });
  it("appends approvals, revocations and reapprovals; replays cannot resurrect authority", async () => {
    approval = approve(); const first = await rpc("decide_membership",approval);
    expect(first).toMatchObject({revision:1,active:true,decision:"approve",assuranceLabel:"demo_provisioned"});
    expect(await rpc("decide_membership",approval)).toEqual(first);
    const revoked = await rpc("decide_membership",approve({decision:"revoke",expiresAt:null,expectedRevision:1}));
    expect(revoked).toMatchObject({revision:2,active:false,decision:"revoke"});
    expect(await rpc("decide_membership",approval)).toMatchObject({revision:2,active:false,appliedDecisionId:first.appliedDecisionId,currentDecisionId:revoked.currentDecisionId});
    await expect(rpc("decide_membership",approve({expectedRevision:1}))).rejects.toMatchObject({message:"VERSION_CONFLICT"});
    const renewed = await rpc("decide_membership",approve({expectedRevision:2}));
    expect(renewed).toMatchObject({revision:3,active:true});
    expect(renewed.currentDecisionId).not.toEqual(first.currentDecisionId);
  });
  it("keeps client roles off private data and anonymous/service roles off both new RPCs", async () => {
    for (const role of ["anon","authenticated","service_role"]) {
      await expect(run("select * from private.company_membership_decisions",[],claims(),role)).rejects.toMatchObject({code:"42501"});
      if(role!=="authenticated") await expect(run("select api.provision_company($1)",[JSON.stringify(provision)],claims(),role)).rejects.toMatchObject({code:"42501"});
    }
    const grants=await db.query(`select r, has_function_privilege(r,'api.provision_company(jsonb)','EXECUTE') as company,has_function_privilege(r,'api.decide_membership(jsonb)','EXECUTE') as membership from unnest(array['anon','authenticated','service_role']) r`);
    expect(grants.rows).toEqual([{r:"anon",company:false,membership:false},{r:"authenticated",company:true,membership:true},{r:"service_role",company:false,membership:false}]);
    await expect(run("update private.company_membership_decisions set reason='tampered'",[],claims(),"fw_authority_exec")).rejects.toMatchObject({code:"42501"});
    await expect(db.exec("update private.company_membership_decisions set reason='tampered'")).rejects.toMatchObject({message:"ACTION_FORBIDDEN"});
  });
  it("cannot commit a null root, stale pointer or an unlinked immutable decision", async () => {
    await expect(run(`insert into private.company_memberships(company_id,subject_id) values('${company}','${C}')`,[],claims(),"fw_authority_exec")).rejects.toMatchObject({message:"ACTION_FORBIDDEN"});
    await expect(run(`update private.company_memberships set current_decision_id=null where company_id='${company}'`,[],claims(),"fw_authority_exec")).rejects.toMatchObject({message:"ACTION_FORBIDDEN"});
    await expect(run(`insert into private.company_membership_decisions(company_id,subject_id,sequence,previous_decision_id,decision,approver_id,reviewed_evidence_refs,reason,policy_version) select company_id,subject_id,revision+1,current_decision_id,'revoke','${A}',array['demo:fixture'],'revoke','demo-authority.v1' from private.company_memberships where company_id='${company}'`,[],claims(),"fw_authority_exec")).rejects.toMatchObject({message:"ACTION_FORBIDDEN"});
  });
  it("preserves Auth grants, FORCE RLS and narrow executor properties", async () => {
    expect((await db.query(`select rolcanlogin,rolsuper,rolbypassrls,rolcreaterole,has_schema_privilege(rolname,'auth','USAGE') as auth,has_schema_privilege(rolname,'private','CREATE') as ddl from pg_roles where rolname='fw_authority_exec'`)).rows).toEqual([{rolcanlogin:false,rolsuper:false,rolbypassrls:false,rolcreaterole:false,auth:false,ddl:false}]);
    expect((await db.query(`select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r' and (not c.relrowsecurity or not c.relforcerowsecurity or pg_get_userbyid(c.relowner)<>'fw_schema_owner')`)).rows).toEqual([{n:0}]);
  });
  it("audits each successful mutation once and separates receipt/quota families", async () => {
    expect((await db.query("select count(*)::int as n from private.audit_logs where action in ('provision_company','decide_membership')")).rows).toEqual([{n:4}]);
    expect(await run("select * from private.command_receipts where command='provision_company'",[],claims(),"fw_user_exec")).toEqual([]);
    expect(await run("select * from private.rate_limit_buckets where operation='authority_write'",[],claims(),"fw_user_exec")).toEqual([]);
    expect(await run("select * from private.command_receipts where command='create_profile'",[],claims(),"fw_authority_exec")).toEqual([]);
    await expect(run(`insert into private.audit_logs(actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class) values('${A}','create_profile','${A}',gen_random_uuid(),array['display_name'],'offline_capability_bootstrap','authority')`,[],claims(),"fw_user_exec")).rejects.toMatchObject({code:"42501"});
  });
  it("passes every Day 2 catalog invariant, including the expanded exact allowlist",async()=>{
    const reports=await db.exec(await readFile("scripts/day2-hosted-catalog.sql","utf8"));
    const checks=reports.flatMap(result=>result.rows) as {check_name:string;result:string}[];
    expect(checks).toHaveLength(18);expect(checks.filter(check=>check.result!=="PASS")).toEqual([]);
  });
  it("withdraws eligibility when an approval naturally expires or its subject is suspended",async()=>{
    await db.exec(`update private.profiles set account_state='suspended' where id='${B}'`);
    expect(await run("select private.active_authority($1,$2) as authority",[company,B],claims(),"fw_authority_exec")).toEqual([{authority:null}]);
    await expect(rpc("decide_membership",approve({expectedRevision:3}))).rejects.toMatchObject({message:"NOT_FOUND"});
    await db.exec(`update private.profiles set account_state='active' where id='${B}'`);
    const result=await rpc("decide_membership",approve({subjectId:C,expiresAt:new Date(Date.now()+3000).toISOString()}));
    expect(result.active).toBe(true);
    await new Promise(resolve=>setTimeout(resolve,3100));
    expect(await run("select private.active_authority($1,$2) as authority",[company,C],claims(),"fw_authority_exec")).toEqual([{authority:null}]);
  });
  it("bootstraps only with existing offline authority, distinct identities, verified TOTP and atomic audit",async()=>{
    const source=await readFile("scripts/day2-bootstrap-capability.sql","utf8");
    await db.exec("set role postgres");
    try {await expect(db.exec(source)).rejects.toMatchObject({message:expect.stringContaining("existing authorized offline administrator")});}
    finally {await db.exec("rollback; reset role");}
    // Fixture-only administrative rights model the separately gated offline
    // bootstrap. The runtime roles and managed Auth grants never change.
    await db.exec(`create table auth.mfa_factors(id uuid,user_id uuid,factor_type text,status text);
      insert into auth.mfa_factors values('${B}','${B}','totp','verified'),('${C}','${C}','totp','verified');
      grant select on auth.mfa_factors to postgres; alter role postgres bypassrls; set role postgres;`);
    const script=source.replace('operator_id uuid := null',`operator_id uuid := '${B}'`).replace('target_subject uuid := null',`target_subject uuid := '${C}'`)
      .replace('operator_factor uuid := null',`operator_factor uuid := '${B}'`).replace('subject_factor uuid := null',`subject_factor uuid := '${C}'`)
      .replace('assignment_id uuid := null',`assignment_id uuid := '${crypto.randomUUID()}'`)
      .replace('approval_record text := null',"approval_record text := 'Local synthetic fixture approver, test-only rehearsal'")
      .replace('approved_until timestamptz := null',"approved_until timestamptz := transaction_timestamp()+interval '1 day'");
    try {
      await expect(db.exec(script.replace(`operator_id uuid := '${B}'`,`operator_id uuid := '${C}'`))).rejects.toMatchObject({message:expect.stringContaining("distinct identities")});await db.exec("rollback");
      await db.exec(script);
      await expect(db.exec(script)).rejects.toMatchObject({message:expect.stringContaining("active assignment already exists")});await db.exec("rollback");
    } finally {await db.exec("reset role; alter role postgres nobypassrls");}
    expect((await db.query("select count(*)::int as n from private.audit_logs where action='bootstrap_capability'")).rows).toEqual([{n:1}]);
  });
  it("enforces quotas on direct RPC calls and rolls back denied mutations",async()=>{
    await db.exec(`insert into private.rate_limit_buckets(subject_hash,operation,window_start,count,expires_at)
      values(encode(sha256(convert_to('${A}','UTF8')),'hex'),'authority_write',date_trunc('minute',now()),30,date_trunc('minute',now())+interval '2 minutes')
      on conflict(subject_hash,operation,window_start) do update set count=30;`);
    const before=await db.query("select count(*)::int as n from private.companies");
    await expect(rpc("provision_company",{name:"Quota blocked",idempotencyKey:crypto.randomUUID()})).rejects.toMatchObject({message:"RATE_LIMITED"});
    expect((await db.query("select count(*)::int as n from private.companies")).rows).toEqual(before.rows);
  });
  it("reauthorizes receipt replays after capability revocation", async () => {
    await db.exec(`update private.capability_assignments set revoked_at=transaction_timestamp() where subject_id='${A}'`);
    await expect(rpc("provision_company",provision)).rejects.toMatchObject({message:"ACTION_FORBIDDEN"});
    await expect(rpc("decide_membership",approval)).rejects.toMatchObject({message:"ACTION_FORBIDDEN"});
  });
});
