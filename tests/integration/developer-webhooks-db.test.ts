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
    await runMigration(await readFile("supabase/migrations/202610140002_work_records.sql", "utf8"));
    if(existsSync("supabase/migrations/202610140003_work_integrity_passport.sql")) await runMigration(await readFile("supabase/migrations/202610140003_work_integrity_passport.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/202610150001_work_case_review.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/20261026140000_credential_register.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/20261027140000_developer_keys.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/20261027160000_developer_webhooks.sql", "utf8"));
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

async function clearQuotas() { await db.exec("delete from private.rate_limit_buckets"); }

const secretOf = () => (crypto.randomUUID().replace(/-/g, "") + "abcdefghijklmnopqrstuv").slice(0, 43);
const hook = (over: Record<string, unknown> = {}) => ({ webhookId: crypto.randomUUID(), url: "https://hooks.example.test/oryqen", secret: secretOf(), ...over });
const rpc = async (name: string, request: unknown, actor: string | null = WORKER) => (await run<{ value: Record<string, unknown> }>(`select api.${name}($1::jsonb) value`, [request], actor ? claims(actor) : {}, actor ? "authenticated" : "anon"))[0]!.value;

describe("developer webhooks", () => {
  it("registers an endpoint for its owner; the list never shows the secret, the targets call does, and only for the owner", async () => {
    await clearQuotas();
    const request = hook();
    expect(await rpc("webhook_create", request)).toEqual({ webhookId: request.webhookId, url: request.url });
    const listed = await rpc("webhook_list", {});
    expect(listed.items).toEqual([expect.objectContaining({ webhookId: request.webhookId, url: request.url, lastDelivery: null })]);
    expect(JSON.stringify(listed)).not.toContain(request.secret as string);
    expect((await rpc("webhook_targets", {})).items).toEqual([{ webhookId: request.webhookId, url: request.url, secret: request.secret }]);
    expect((await rpc("webhook_list", {}, OTHER)).items).toEqual([]);
    expect((await rpc("webhook_targets", {}, OTHER)).items).toEqual([]);
    await rpc("webhook_delete", { webhookId: request.webhookId });
  });

  it("records delivery attempts for the owner only and shows the latest one", async () => {
    await clearQuotas();
    const request = hook(); await rpc("webhook_create", request);
    const log = (over: Record<string, unknown>) => ({ webhookId: request.webhookId, eventId: crypto.randomUUID(), eventType: "credential.revoked", attempt: 1, outcome: "failed", statusCode: 503, ...over });
    await rpc("webhook_log", log({ attempt: 1 }));
    await rpc("webhook_log", log({ attempt: 2, outcome: "delivered", statusCode: 200 }));
    expect(((await rpc("webhook_list", {})).items as { lastDelivery: unknown }[])[0]!.lastDelivery).toMatchObject({ outcome: "delivered", statusCode: 200, attempt: 2, eventType: "credential.revoked" });
    await rpc("webhook_log", log({ attempt: 3, outcome: "failed", statusCode: null }));
    await expect(rpc("webhook_log", log({}), OTHER)).rejects.toThrow("NOT_FOUND");
    for (const bad of [{ eventType: "user.deleted" }, { outcome: "maybe" }, { attempt: 6 }, { attempt: "1" }, { statusCode: 99 }, { statusCode: "200" }]) await expect(rpc("webhook_log", log(bad)), JSON.stringify(bad)).rejects.toThrow("VALIDATION_FAILED");
    expect(await run("select count(*)::int c from private.developer_webhook_deliveries where webhook_id=$1", [request.webhookId], claims(OTHER), "fw_user_exec")).toEqual([{ c: 0 }]);
    await rpc("webhook_delete", { webhookId: request.webhookId });
  });

  it("deletes only the owner's endpoint, with its delivery history, and refuses anyone else", async () => {
    await clearQuotas();
    const request = hook(); await rpc("webhook_create", request);
    await rpc("webhook_log", { webhookId: request.webhookId, eventId: crypto.randomUUID(), eventType: "ping", attempt: 1, outcome: "delivered", statusCode: 200 });
    await expect(rpc("webhook_delete", { webhookId: request.webhookId }, OTHER)).rejects.toThrow("NOT_FOUND");
    expect(await rpc("webhook_delete", { webhookId: request.webhookId })).toEqual({ webhookId: request.webhookId, status: "deleted" });
    await expect(rpc("webhook_delete", { webhookId: request.webhookId })).rejects.toThrow("NOT_FOUND");
    expect(await run("select count(*)::int c from private.developer_webhook_deliveries where webhook_id=$1", [request.webhookId], claims(WORKER), "fw_user_exec")).toEqual([{ c: 0 }]);
  });

  it("allows three endpoints per person and frees a slot on deletion", async () => {
    await clearQuotas();
    const made: string[] = [];
    for (let i = 0; i < 3; i += 1) { const request = hook(); made.push(request.webhookId as string); await rpc("webhook_create", request, MEMBER); }
    await expect(rpc("webhook_create", hook(), MEMBER)).rejects.toThrow("RATE_LIMITED");
    await rpc("webhook_delete", { webhookId: made[0] }, MEMBER);
    await rpc("webhook_create", hook(), MEMBER);
  });

  it("rejects insecure or malformed addresses, bad secrets, extra fields and reused ids", async () => {
    await clearQuotas();
    for (const bad of [{ url: "http://hooks.example.test/x" }, { url: "ftp://hooks.example.test/x" }, { url: "https://user@hooks.example.test/x" }, { url: "https://hooks.example.test/a b" }, { url: "https://" }, { url: "https://a.b" }, { url: "https://hooks.example.test/" + "x".repeat(300) }, { secret: "short" }, { secret: "!".repeat(43) }, { webhookId: "nope" }])
      await expect(rpc("webhook_create", hook(bad), APPROVER), JSON.stringify(bad).slice(0, 60)).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("webhook_create", { ...hook(), extra: "x" }, APPROVER)).rejects.toThrow("VALIDATION_FAILED");
    const request = hook(); await rpc("webhook_create", request, APPROVER);
    await expect(rpc("webhook_create", request, APPROVER)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
  });

  it("is closed to anonymous callers and its tables cannot be read through the public roles", async () => {
    for (const name of ["webhook_list", "webhook_targets", "webhook_create"]) await expect(rpc(name, name === "webhook_create" ? hook() : {}, null), name).rejects.toThrow();
    await expect(run("select secret from private.developer_webhooks", [], claims(WORKER))).rejects.toThrow();
    const exposed = await db.query<{ proname: string }>("select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='api' and has_function_privilege('anon',p.oid,'EXECUTE') order by 1");
    expect(exposed.rows.map(row => row.proname)).toEqual(["credential_status", "developer_key_check"]);
  });
});
