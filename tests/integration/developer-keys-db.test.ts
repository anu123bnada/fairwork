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
    await runMigration(await readFile("supabase/migrations/20261027140000_developer_keys.sql", "utf8"));
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



const hashOf = (secret: string) => createHash("sha256").update(secret).digest("hex");
const newKey = (over: Record<string, unknown> = {}) => { const secret = crypto.randomUUID().replace(/-/g, "") + "x"; return { secret, request: { keyId: crypto.randomUUID(), label: "Synthetic HR integration", secretHash: hashOf(secret), ...over } }; };
const rpc = async (name: string, request: unknown, actor: string | null = WORKER) => (await run<{ value: Record<string, unknown> }>(`select api.${name}($1::jsonb) value`, [request], actor ? claims(actor) : {}, actor ? "authenticated" : "anon"))[0]!.value;

describe("developer keys", () => {
  it("creates a key for its owner, lists it with usage, and the anonymous check accepts only the matching secret", async () => {
    await clearQuotas();
    const { secret, request } = newKey();
    expect(await rpc("developer_key_create", request)).toEqual({ keyId: request.keyId, scopes: ["credentials:verify"] });
    expect((await rpc("developer_key_list", {})).items).toEqual([expect.objectContaining({ keyId: request.keyId, label: "Synthetic HR integration", scopes: ["credentials:verify"], revokedAt: null, callsLast24h: 0 })]);
    expect(await rpc("developer_key_check", { keyId: request.keyId, secretHash: hashOf(secret) }, null)).toEqual({ valid: true, scopes: ["credentials:verify"] });
    expect(await rpc("developer_key_check", { keyId: request.keyId, secretHash: hashOf(secret + "1") }, null)).toEqual({ valid: false, scopes: [] });
    expect(await rpc("developer_key_check", { keyId: crypto.randomUUID(), secretHash: hashOf(secret) }, null)).toEqual({ valid: false, scopes: [] });
    expect((await rpc("developer_key_list", {})).items).toEqual([expect.objectContaining({ callsLast24h: 1 })]); // only the valid call is metered
  });

  it("keeps keys private to the owner, and only the owner can revoke; revocation takes effect at once", async () => {
    await clearQuotas();
    const { secret, request } = newKey();
    await rpc("developer_key_create", request);
    expect((await rpc("developer_key_list", {}, OTHER)).items).toEqual([]);
    await expect(rpc("developer_key_revoke", { keyId: request.keyId }, OTHER)).rejects.toThrow("NOT_FOUND");
    expect(await rpc("developer_key_check", { keyId: request.keyId, secretHash: hashOf(secret) }, null)).toMatchObject({ valid: true });
    expect(await rpc("developer_key_revoke", { keyId: request.keyId })).toEqual({ keyId: request.keyId, status: "revoked" });
    expect(await rpc("developer_key_revoke", { keyId: request.keyId })).toEqual({ keyId: request.keyId, status: "revoked" });
    expect(await rpc("developer_key_check", { keyId: request.keyId, secretHash: hashOf(secret) }, null)).toEqual({ valid: false, scopes: [] });
    expect(((await rpc("developer_key_list", {})).items as { keyId: string }[]).find(item => item.keyId === request.keyId)).toMatchObject({ revokedAt: expect.any(String) });
  });

  it("enforces sixty checks a minute per key and five active keys per person", async () => {
    await clearQuotas();
    const { secret, request } = newKey();
    await rpc("developer_key_create", request, MEMBER);
    for (let i = 0; i < 60; i += 1) await rpc("developer_key_check", { keyId: request.keyId, secretHash: hashOf(secret) }, null);
    await expect(rpc("developer_key_check", { keyId: request.keyId, secretHash: hashOf(secret) }, null)).rejects.toThrow("RATE_LIMITED");
    await clearQuotas();
    for (let i = 0; i < 4; i += 1) await rpc("developer_key_create", newKey().request, MEMBER);
    await expect(rpc("developer_key_create", newKey().request, MEMBER)).rejects.toThrow("RATE_LIMITED");
    const [first] = (await rpc("developer_key_list", {}, MEMBER)).items as { keyId: string }[];
    await rpc("developer_key_revoke", { keyId: first!.keyId }, MEMBER);
    await rpc("developer_key_create", newKey().request, MEMBER); // revoking frees a slot
  });

  it("rejects malformed requests and reused ids, and the key table cannot be read or rewritten directly", async () => {
    await clearQuotas();
    const { request } = newKey();
    for (const bad of [{ label: "" }, { label: "x".repeat(61) }, { secretHash: "abc" }, { keyId: "nope" }]) await expect(rpc("developer_key_create", { ...request, keyId: crypto.randomUUID(), ...bad }), JSON.stringify(bad)).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("developer_key_create", { ...request, scopes: ["credentials:verify"] })).rejects.toThrow("VALIDATION_FAILED");
    await rpc("developer_key_create", request, APPROVER);
    await expect(rpc("developer_key_create", request, APPROVER)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await expect(rpc("developer_key_check", { keyId: request.keyId }, null)).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("developer_key_check", { keyId: request.keyId, secretHash: "short" }, null)).rejects.toThrow("VALIDATION_FAILED");
    await expect(run("select secret_hash from private.developer_keys", [], claims(WORKER))).rejects.toThrow();
    await expect(run("update private.developer_keys set scopes=array['credentials:verify']", [], claims(APPROVER), "fw_user_exec")).rejects.toThrow();
    expect(await run("select id from private.developer_keys", [], claims(OTHER), "fw_user_exec")).toEqual([]);
  });

  it("exposes exactly two functions to anonymous callers: credential status and the key check", async () => {
    const exposed = await db.query<{ proname: string }>("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and has_function_privilege('anon',p.oid,'EXECUTE') order by 1");
    expect(exposed.rows.map(row => row.proname)).toEqual(["credential_status", "developer_key_check"]);
    await expect(rpc("developer_key_list", {}, null)).rejects.toThrow();
    await expect(rpc("developer_key_create", newKey().request, null)).rejects.toThrow();
  });
});
