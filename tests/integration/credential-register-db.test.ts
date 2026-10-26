import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
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
    await runMigration(await readFile("supabase/migrations/202610140002_work_records.sql", "utf8"));
    if(existsSync("supabase/migrations/202610140003_work_integrity_passport.sql")) await runMigration(await readFile("supabase/migrations/202610140003_work_integrity_passport.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/202610150001_work_case_review.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/20261026140000_credential_register.sql", "utf8"));
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

async function integrity(input:Record<string,unknown>,actor=WORKER){return (await run<{value:Record<string,unknown>}>("select api.work_integrity($1::jsonb) value",[{idempotencyKey:crypto.randomUUID(),...input}],claims(actor)))[0]!.value;}
async function verified(){const c=await submitted();await work({operation:"decide",...workExpected(c.id,c.v),outcome:"verified",reason:"Reviewed exact work"},APPROVER);return {...c,v:(await workRead(c.id)).versions[0]!};}
const withdraw=(c:{id:string;v:WorkVersion})=>({operation:"withdraw",...workExpected(c.id,c.v),reason:"Worker no longer presents this record"});


const TOKEN = "eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJzeW50aGV0aWMtdGVzdC1wYXlsb2FkIiwidiI6MX0." + "A".repeat(86);
const claimRefOf = (workId: string, version: number, contentHash: string) => createHash("sha256").update(["oryqen-trust-claim.v1", "work_record", workId, version, contentHash].join("|")).digest("hex");
const rpc = async (name: string, request: unknown, actor: string | null = WORKER) => (await run<{ value: Record<string, unknown> }>(`select api.${name}($1::jsonb) value`, [request], actor ? claims(actor) : {}, actor ? "authenticated" : "anon"))[0]!.value;
async function verifiedRecord() {
  const c = await verified(); await clearQuotas();
  const read = await workRead(c.id), v = read.versions.at(-1)!;
  return { workId: c.id, version: v.version, contentHash: v.contentHash, c };
}
const register = (r: { workId: string; version: number; contentHash: string }, over: Record<string, unknown> = {}) => ({
  credentialId: crypto.randomUUID(), sourceId: r.workId, sourceVersion: r.version, claimRef: claimRefOf(r.workId, r.version, r.contentHash),
  assurance: "independently_reviewed", expiresAt: new Date(Date.now() + 90 * 86400000).toISOString(), keyId: "test-key-1", token: TOKEN, idempotencyKey: crypto.randomUUID(), ...over,
});

describe("credential register, status and revocation", () => {
  it("registers a credential for the worker's verified record, lists it, and reports it valid to an anonymous verifier", async () => {
    const r = await verifiedRecord(), request = register(r);
    expect(await rpc("credential_register", request)).toMatchObject({ credentialId: request.credentialId, token: TOKEN, replayed: false });
    const listed = (await rpc("credential_list", {})).items as Record<string, unknown>[];
    expect(listed.find(item => item.credentialId === request.credentialId)).toMatchObject({ status: "valid", assurance: "independently_reviewed", token: TOKEN });
    const publicView = await rpc("credential_status", { credentialId: request.credentialId }, null);
    expect(publicView).toMatchObject({ status: "valid", reason: null });
    expect(Object.keys(publicView).sort()).toEqual(["checkedAt", "reason", "status"]); // no identity, content, token or source id
  });
  it("replays idempotently with the stored token and refuses changed input under the same key", async () => {
    const r = await verifiedRecord(), request = register(r);
    const first = await rpc("credential_register", request);
    expect(await rpc("credential_register", { ...request, credentialId: crypto.randomUUID(), token: TOKEN.replace("eyJh", "eyJi") })).toMatchObject({ credentialId: first.credentialId, token: TOKEN, replayed: true });
    await expect(rpc("credential_register", { ...request, claimRef: "0".repeat(64) })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });
  it("refuses forged references, other people's records, unverified records and malformed input", async () => {
    const r = await verifiedRecord();
    await expect(rpc("credential_register", register(r, { claimRef: claimRefOf(r.workId, r.version, "f".repeat(64)) }))).rejects.toThrow("VERSION_CONFLICT");
    await expect(rpc("credential_register", register(r), OTHER)).rejects.toThrow("NOT_FOUND");
    await expect(rpc("credential_register", register(r), APPROVER)).rejects.toThrow("ACTION_FORBIDDEN"); // reviewers cannot issue for the worker
    await expect(rpc("credential_register", register(r, { sourceVersion: 2 }))).rejects.toThrow("ACTION_FORBIDDEN");
    const pending = await submitted(); const pendingRead = (await workRead(pending.id)).versions[0]!;
    await expect(rpc("credential_register", register({ workId: pending.id, version: 1, contentHash: pendingRead.contentHash }))).rejects.toThrow("VERSION_CONFLICT");
    for (const bad of [{ token: "not-a-token" }, { assurance: "self_reported" }, { assurance: "counterparty_acknowledged" }, { claimRef: "xyz" }, { expiresAt: new Date(Date.now() - 1000).toISOString() }, { expiresAt: new Date(Date.now() + 400 * 86400000).toISOString() }, { extra: 1 }, { sourceVersion: "1" }])
      await expect(rpc("credential_register", register(r, bad))).rejects.toThrow("VALIDATION_FAILED");
    expect(await rpc("credential_list", {}, OTHER)).toEqual({ items: [] });
  });
  it("lets only the holder revoke, once, with an immediate public effect, and keeps history append-only", async () => {
    const r = await verifiedRecord(), request = register(r);
    await rpc("credential_register", request);
    await expect(rpc("credential_revoke", { credentialId: request.credentialId }, OTHER)).rejects.toThrow("NOT_FOUND");
    await expect(rpc("credential_revoke", { credentialId: request.credentialId }, APPROVER)).rejects.toThrow("NOT_FOUND");
    expect(await rpc("credential_revoke", { credentialId: request.credentialId })).toMatchObject({ status: "revoked" });
    expect(await rpc("credential_revoke", { credentialId: request.credentialId })).toMatchObject({ status: "revoked" });
    expect(await rpc("credential_status", { credentialId: request.credentialId }, null)).toMatchObject({ status: "revoked", reason: "holder_requested" });
    await expect(db.exec("update private.credentials set key_id='x'")).rejects.toThrow("ACTION_FORBIDDEN");
    await expect(db.exec("delete from private.credential_events")).rejects.toThrow("ACTION_FORBIDDEN");
    const count = await db.query<{ n: number }>("select count(*)::int n from private.credential_events where credential_id=$1", [request.credentialId]);
    expect(Number(count.rows[0]!.n)).toBe(2);
  });
  it("revokes automatically when the source record is withdrawn, and reports unknown and invalid requests", async () => {
    const r = await verifiedRecord(), request = register(r);
    await rpc("credential_register", request);
    expect(await rpc("credential_status", { credentialId: request.credentialId }, null)).toMatchObject({ status: "valid" });
    await integrity(withdraw(r.c));
    expect(await rpc("credential_status", { credentialId: request.credentialId }, null)).toMatchObject({ status: "revoked", reason: "source_changed" });
    const listed = (await rpc("credential_list", {})).items as Record<string, unknown>[];
    expect(listed.find(item => item.credentialId === request.credentialId)).toMatchObject({ status: "revoked", reason: "source_changed" });
    expect(await rpc("credential_status", { credentialId: crypto.randomUUID() }, null)).toMatchObject({ status: "unknown" });
    for (const bad of [{}, { credentialId: "nope" }, { credentialId: crypto.randomUUID(), extra: 1 }]) await expect(rpc("credential_status", bad, null)).rejects.toThrow("VALIDATION_FAILED");
  });
  it("reports an elapsed credential as expired", async () => {
    const r = await verifiedRecord(), soon = register(r);
    await rpc("credential_register", soon);
    await db.exec(`set session_replication_role = replica; update private.credentials set expires_at = issued_at + interval '1 second' where id='${soon.credentialId}'; reset session_replication_role;`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    expect(await rpc("credential_status", { credentialId: soon.credentialId }, null)).toMatchObject({ status: "expired" });
  });
  it("is not directly readable or writable by clients, only status is public, and the policy role sees no record content", async () => {
    const access = await db.query<Record<string, boolean>>(`select
      has_table_privilege('authenticated','private.credentials','SELECT') t1, has_table_privilege('anon','private.credentials','SELECT') t2,
      has_function_privilege('anon','api.credential_status(jsonb)','EXECUTE') s_anon, has_function_privilege('anon','api.credential_register(jsonb)','EXECUTE') r_anon,
      has_function_privilege('anon','api.credential_list(jsonb)','EXECUTE') l_anon, has_function_privilege('anon','api.credential_revoke(jsonb)','EXECUTE') v_anon,
      has_function_privilege('authenticated','private.credential_status(uuid)','EXECUTE') helper,
      (select relforcerowsecurity from pg_class where oid='private.credentials'::regclass) f1, (select relforcerowsecurity from pg_class where oid='private.credential_events'::regclass) f2,
      has_column_privilege('fw_policy_exec','private.work_record_versions','content','SELECT') content_leak, has_column_privilege('fw_policy_exec','private.work_record_versions','state','SELECT') state_ok`);
    const exposed = await db.query<{ proname: string }>("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and has_function_privilege('anon',p.oid,'EXECUTE') order by 1");
    expect(exposed.rows.map(row => row.proname)).toEqual(["credential_status"]); // granting schema usage to anon exposes nothing else
    expect(access.rows[0]).toEqual({ t1: false, t2: false, s_anon: true, r_anon: false, l_anon: false, v_anon: false, helper: false, f1: true, f2: true, content_leak: false, state_ok: true });
  });
});
