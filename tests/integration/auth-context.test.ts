import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const db = new PGlite();
const A = "30000000-0000-4000-8000-000000000001";
const B = "30000000-0000-4000-8000-000000000002";
const migrationPath = "supabase/migrations/202610080002_identity_auth_context.sql";
const actor = async (role: string, claims: unknown, sql: string, params: unknown[] = []) => {
  await db.exec(`begin; set local role ${role}`);
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [typeof claims === "string" ? claims : JSON.stringify(claims)]);
    const result = await db.query(sql, params);
    await db.exec("commit");
    return result.rows;
  } catch (error) { await db.exec("rollback"); throw error; }
};
const claims = (id: string) => ({ sub: id, role: "authenticated", aal: "aal1", is_anonymous: false });

// Includes managed Auth ACLs/ownership, private table/column ACLs, FORCE RLS,
// all existing function ACLs/owners, memberships, triggers and policy predicates.
async function boundary(ignoreRpcAcl = false) {
  const result = await db.query(`select jsonb_build_object(
    'schemas',(select jsonb_agg(to_jsonb(x) order by x.nspname) from (
      select nspname,nspowner,nspacl from pg_namespace where nspname in ('auth','private','api')) x),
    'tables',(select jsonb_agg(to_jsonb(x) order by x.oid) from (
      select c.oid,c.relname,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity
      from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('auth','private','api') and c.relkind='r') x),
    'columns',(select jsonb_agg(to_jsonb(x) order by x.attrelid,x.attnum) from (
      select a.attrelid,a.attnum,a.attacl from pg_attribute a
      join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname in ('auth','private','api') and a.attnum>0 and not a.attisdropped) x),
    'functions',(select jsonb_agg(to_jsonb(x) order by x.oid) from (
      select p.oid,p.proowner,case when $1 and n.nspname='api' then null else p.proacl end as proacl,p.prosecdef,p.proconfig,p.prosrc
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname in ('auth','private','api') and p.proname not in ('request_uid','request_jwt')) x),
    'policies',(select jsonb_agg(to_jsonb(p) order by p.policyname) from pg_policies p where schemaname='private'),
    'triggers',(select jsonb_agg(to_jsonb(x) order by x.oid) from (
      select t.oid,t.tgname,t.tgfoid,t.tgenabled from pg_trigger t
      join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='private') x),
    'roles',(select jsonb_agg(to_jsonb(r) order by r.rolname) from pg_roles r),
    'memberships',(select jsonb_agg(to_jsonb(m) order by m.roleid,m.member) from pg_auth_members m)
  ) as snapshot`, [ignoreRpcAcl]);
  // The sole permitted edit to existing function bodies and RLS predicates.
  return JSON.stringify(result.rows).replaceAll("private.request_uid()", "auth.uid()").replaceAll("private.request_jwt()", "auth.jwt()");
}

beforeAll(async () => {
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create role service_role nologin bypassrls;
    create role managed_auth_owner nologin;
    create role local_fixture_root superuser;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth to anon,authenticated,service_role;
    insert into auth.users values ('${A}'),('${B}');
  `);
  await db.exec(await readFile("supabase/migrations/202610070001_identity_foundation.sql", "utf8"));
  await db.exec(`
    create schema supabase_migrations;
    create table supabase_migrations.schema_migrations(version text primary key, name text);
    insert into supabase_migrations.schema_migrations values ('202610070001','identity_foundation');
    revoke usage on schema auth from fw_user_exec,fw_policy_exec;
    alter schema auth owner to managed_auth_owner;
    alter function auth.uid() owner to managed_auth_owner;
    alter function auth.jwt() owner to managed_auth_owner;
    alter table auth.users owner to managed_auth_owner;
    revoke all on schema auth from postgres;
    set session authorization local_fixture_root;
    -- PostgreSQL forbids demoting the bootstrap superuser. Rename that fixture
    -- identity and create an ordinary postgres role matching hosted authority.
    alter role postgres rename to local_bootstrap_owner;
    create role postgres login inherit nosuperuser nobypassrls;
    grant fw_schema_owner,fw_user_exec,fw_policy_exec to postgres;
    grant usage on schema auth to postgres;
    alter schema supabase_migrations owner to postgres;
    alter table supabase_migrations.schema_migrations owner to postgres;
  `);
});
afterAll(async () => { await db.close(); });

describe("private Auth context without managed-schema grant authority", () => {
  it("fails the old proposal, then applies the new migration as a non-superuser postgres with no auth grant option", async () => {
    const privilege = await db.query("select rolsuper,rolbypassrls,has_schema_privilege('postgres','auth','USAGE WITH GRANT OPTION') as can_grant from pg_roles where rolname='postgres'");
    expect(privilege.rows).toEqual([{ rolsuper: false, rolbypassrls: false, can_grant: false }]);
    await expect(actor("authenticated", claims(A), "select api.get_me('{}')")).rejects.toMatchObject({ code: "42501" });
    await db.exec("set role postgres");
    try {
      await expect(db.exec(await readFile("docs/superseded/202610080001_identity_auth_schema_usage.sql", "utf8"))).rejects.toMatchObject({ code: "P0001", message: "Auth schema USAGE repair requires an authorized offline grantor" });
    } finally { await db.exec("rollback; reset role"); }
    const before = await boundary();
    await db.exec("set role postgres");
    try {
      const preflight = await db.query<{ preflight: { checks: { check: string; result: string }[] } }>(await readFile("scripts/day1-auth-context-preflight.sql", "utf8"));
      expect(preflight.rows[0]!.preflight.checks).toHaveLength(10);
      expect(preflight.rows[0]!.preflight.checks.filter(check => check.result !== "PASS")).toEqual([]);
      await db.exec(await readFile(migrationPath, "utf8"));
    }
    finally { await db.exec("reset role"); }
    expect(await boundary()).toBe(before);
    const priv = await db.query("select has_schema_privilege(name,'auth','USAGE') as usage,has_table_privilege(name,'auth.users','SELECT,INSERT,UPDATE,DELETE') as raw from (values ('fw_user_exec'),('fw_policy_exec')) r(name)");
    expect(priv.rows).toEqual([{ usage: false, raw: false }, { usage: false, raw: false }]);
    await expect(actor("authenticated", claims(A), "select api.get_me('{}')")).rejects.toMatchObject({ code: "P0001", message: "NOT_FOUND" });
  });

  it("restricts the two zero-argument, static, fixed-path helpers to the executors and owner", async () => {
    const funcs = await db.query<{ proname: string; prosrc: string }>(`select p.proname,p.pronargs,p.prosecdef,p.provolatile,p.proconfig,pg_get_userbyid(p.proowner) as owner,p.prosrc
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in ('request_uid','request_jwt') order by p.proname`);
    expect(funcs.rows).toHaveLength(2);
    for (const row of funcs.rows) {
      expect(row).toMatchObject({ pronargs: 0, prosecdef: true, provolatile: "s", proconfig: ['search_path=""'], owner: "postgres" });
      expect(String(row.prosrc).trim()).toBe(row.proname === "request_uid" ? "select auth.uid();" : "select auth.jwt();");
    }
    const acl = await db.query(`select distinct pg_get_userbyid(a.grantee) as grantee from pg_proc p join pg_namespace n on n.oid=p.pronamespace cross join lateral aclexplode(p.proacl) a where n.nspname='private' and p.proname in ('request_uid','request_jwt') order by grantee`);
    expect(acl.rows).toEqual([{ grantee: "fw_policy_exec" }, { grantee: "fw_user_exec" }, { grantee: "postgres" }]);
    for (const role of ["anon", "authenticated", "service_role"]) {
      for (const name of ["request_uid", "request_jwt"]) {
        await expect(actor(role, claims(A), `select private.${name}()`)).rejects.toMatchObject({ code: "42501" });
      }
    }
    await expect(actor("fw_user_exec", claims(A), "alter function private.request_uid() security invoker")).rejects.toMatchObject({ code: "42501" });
    await expect(actor("fw_policy_exec", claims(A), "create or replace function private.request_jwt() returns jsonb language sql as $$ select '{}'::jsonb $$")).rejects.toMatchObject({ code: "42501" });
  });

  it("preserves per-request claims, ignores search-path shadows, and fails closed on missing or malformed identity", async () => {
    await db.exec(`create function public.uid() returns uuid language sql as $$ select '${B}'::uuid $$;
      create function public.jwt() returns jsonb language sql as $$ select '{"role":"service_role"}'::jsonb $$;`);
    for (const role of ["fw_user_exec", "fw_policy_exec"]) {
      for (const id of [A, B, A]) {
        const rows = await actor(role, claims(id), "select private.request_uid() as uid,private.request_jwt() as jwt");
        expect(rows).toEqual([{ uid: id, jwt: claims(id) }]);
      }
      expect(await actor(role, "", "select private.request_uid() as uid")).toEqual([{ uid: null }]);
    }
    await db.exec("begin; set local role fw_user_exec; set local search_path=public,pg_temp");
    try {
      await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(claims(A))]);
      expect((await db.query("select private.request_uid() as uid")).rows).toEqual([{ uid: A }]);
    } finally { await db.exec("rollback"); }
    await expect(actor("authenticated", "", "select api.get_me('{}')")).rejects.toMatchObject({ message: "AUTH_REQUIRED" });
    await expect(actor("authenticated", "{", "select api.get_me('{}')")).rejects.toMatchObject({ code: "22P02" });
    await expect(actor("authenticated", { ...claims(A), sub: "not-a-uuid" }, "select api.get_me('{}')")).rejects.toMatchObject({ code: "22P02" });
  });

  it("runs all hosted catalog checks without requiring the retired migration or executor auth USAGE", async () => {
    // CLI bookkeeping is simulated only in this disposable local fixture.
    await db.exec("insert into supabase_migrations.schema_migrations values ('202610080002','identity_auth_context')");
    const results = await db.exec(await readFile("scripts/day1-hosted-catalog.sql", "utf8"));
    const rows = results.flatMap(r => r.rows);
    expect(rows).toHaveLength(16);
    expect(rows.filter(r => r.result !== "PASS")).toEqual([]);
  });

  it("repairs the exact hosted RPC ACL defect as restricted postgres without changing other security boundaries", async () => {
    await db.exec(`grant execute on function api.create_profile(jsonb),api.get_me(jsonb),api.update_profile(jsonb) to anon,service_role;
      grant usage on schema api to anon,service_role;`);
    // Deliberately make schema resolution possible: denial must be EXECUTE,
    // not a masking schema-USAGE error. Schema grants exist only in this fixture.
    const check = await readFile("scripts/day1-rpc-execute-check.sql", "utf8");
    const beforeRows = (await db.query(check)).rows;
    expect(beforeRows).toHaveLength(3);
    for (const row of beforeRows) expect(row).toMatchObject({ anon_execute: true, service_role_execute: true, public_execute: false, result: "FAIL" });
    const beforeCatalog = (await db.exec(await readFile("scripts/day1-hosted-catalog.sql", "utf8"))).flatMap(r => r.rows);
    expect(beforeCatalog.filter(r => r.result !== "PASS")).toEqual([{ check_name: "RPC grants are authenticated-only among public client roles", result: "FAIL" }]);
    const before = await boundary(true);
    const helpersBefore = (await db.query("select proacl,prosrc,proowner,proconfig from pg_proc where oid in ('private.request_uid()'::regprocedure,'private.request_jwt()'::regprocedure) order by oid")).rows;
    await db.exec("set role postgres");
    try {
      for (const row of (await db.query(check)).rows) expect(row).toMatchObject({ migration_role_is_owner: true });
      await db.exec(await readFile("supabase/migrations/202610090001_identity_rpc_execute.sql", "utf8"));
    } finally { await db.exec("reset role"); }
    expect(await boundary(true)).toBe(before);
    expect((await db.query("select proacl,prosrc,proowner,proconfig from pg_proc where oid in ('private.request_uid()'::regprocedure,'private.request_jwt()'::regprocedure) order by oid")).rows).toEqual(helpersBefore);
    for (const row of (await db.query(check)).rows) expect(row).toMatchObject({ authenticated_execute: true, internal_execute: true, anon_execute: false, service_role_execute: false, public_execute: false, anon_set_role_paths: [], service_role_set_role_paths: [], result: "PASS" });
    for (const role of ["anon", "service_role"]) {
      for (const name of ["create_profile", "get_me", "update_profile"]) {
        await expect(actor(role, claims(A), `select api.${name}('{}')`)).rejects.toMatchObject({ code: "42501", message: `permission denied for function ${name}` });
      }
    }
    // Body-level NOT_FOUND confirms both permitted callers reached get_me.
    for (const role of ["authenticated", "fw_user_exec"]) {
      await expect(actor(role, claims(A), "select api.get_me('{}')")).rejects.toMatchObject({ code: "P0001", message: "NOT_FOUND" });
    }
    const afterCatalog = (await db.exec(await readFile("scripts/day1-hosted-catalog.sql", "utf8"))).flatMap(r => r.rows);
    expect(afterCatalog).toHaveLength(16);
    expect(afterCatalog.filter(r => r.result !== "PASS")).toEqual([]);
  });

  it("removes PUBLIC execution even when it is the only source of anonymous access", async () => {
    await db.exec("grant execute on function api.get_me(jsonb) to public");
    expect((await db.query("select has_function_privilege('anon','api.get_me(jsonb)','EXECUTE') as allowed")).rows).toEqual([{ allowed: true }]);
    await db.exec("set role postgres");
    try { await db.exec(await readFile("supabase/migrations/202610090001_identity_rpc_execute.sql", "utf8")); }
    finally { await db.exec("reset role"); }
    const rows = (await db.query<{ result: string }>(await readFile("scripts/day1-rpc-execute-check.sql", "utf8"))).rows;
    expect(rows).toHaveLength(3);
    expect(rows.filter(row => row.result !== "PASS")).toEqual([]);
  });

  it.each([
    ["anon", true], ["service_role", true], ["anon", false], ["service_role", false],
  ])("fails atomically for %s membership with INHERIT %s, without rewriting memberships", async (role, inherit) => {
    await db.exec(`grant authenticated to ${role} with inherit ${inherit}, set true;
      grant execute on function api.get_me(jsonb) to anon,service_role;`);
    const before = await boundary();
    await db.exec("set role postgres");
    try {
      await expect(db.exec(await readFile("supabase/migrations/202610090001_identity_rpc_execute.sql", "utf8"))).rejects.toMatchObject({ code: "P0001", message: "RPC EXECUTE repair failed: required access missing or prohibited client access remains" });
    } finally { await db.exec("rollback; reset role"); }
    expect(await boundary()).toBe(before);
    await db.exec(`revoke authenticated from ${role}`);
    await db.exec("set role postgres");
    try { await db.exec(await readFile("supabase/migrations/202610090001_identity_rpc_execute.sql", "utf8")); }
    finally { await db.exec("reset role"); }
  });
});
