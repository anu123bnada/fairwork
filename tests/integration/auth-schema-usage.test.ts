import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

it("documents the superseded grant proposal: it works only with an authorized schema grantor", async () => {
  const db = new PGlite();
  const actor = "20000000-0000-4000-8000-000000000001";
  const correction = await readFile("docs/superseded/202610080001_identity_auth_schema_usage.sql", "utf8");
  const call = async (name: string, request: Record<string, unknown>) => {
    await db.exec("begin; set local role authenticated");
    try {
      await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: actor, role: "authenticated", aal: "aal1", is_anonymous: false })]);
      const result = await db.query<{ result: { id: string; revision: number; capabilities: string[] } }>(`select api.${name}($1::jsonb) as result`, [JSON.stringify(request)]);
      await db.exec("commit");
      return result.rows[0]!.result;
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }
  };
  const boundary = async () => (await db.query(`
    select jsonb_build_object(
      'tables', (select jsonb_agg(to_jsonb(t) order by t.relname) from (
        select c.relname, c.relowner, c.relacl, c.relrowsecurity, c.relforcerowsecurity
        from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r'
      ) t),
      'columns', (select jsonb_agg(to_jsonb(t) order by t.attrelid, t.attnum) from (
        select a.attrelid, a.attnum, a.attacl from pg_attribute a
        join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='private' and a.attnum>0 and not a.attisdropped
      ) t),
      'policies', (select jsonb_agg(to_jsonb(p) order by p.tablename, p.policyname) from pg_policies p where schemaname='private'),
      'functions', (select jsonb_agg(to_jsonb(t) order by t.oid) from (
        select p.oid, p.proowner, p.proacl, p.prosecdef, p.proconfig, p.prosrc
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('api','private','auth')
      ) t),
      'roles', (select jsonb_agg(to_jsonb(r) order by r.rolname) from pg_roles r where rolname in ('fw_schema_owner','fw_user_exec','fw_policy_exec')),
      'memberships', (select jsonb_agg(to_jsonb(m) order by m.roleid, m.member) from pg_auth_members m),
      'private_schema_acl', (select nspacl::text from pg_namespace where nspname='private'),
      'api_schema_acl', (select nspacl::text from pg_namespace where nspname='api')
    ) as boundary
  `)).rows;
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
      grant usage on schema auth to anon, authenticated, service_role;
      insert into auth.users values ('${actor}');
    `);
    await db.exec(await readFile("supabase/migrations/202610070001_identity_foundation.sql", "utf8"));
    // Reproduce the owner-supplied hosted catalog, not a missing RPC EXECUTE grant.
    await db.exec("revoke usage on schema auth from fw_user_exec, fw_policy_exec");
    const execution = await db.query<{ allowed: boolean }>(`
      select has_function_privilege(r.name, f.name, 'EXECUTE') as allowed
      from (values ('fw_user_exec'),('fw_policy_exec')) r(name)
      cross join (values ('auth.uid()'),('auth.jwt()')) f(name)
    `);
    expect(execution.rows).toEqual(Array(4).fill({ allowed: true }));
    await expect(call("get_me", {})).rejects.toMatchObject({ code: "42501", message: "permission denied for schema auth" });
    // Fixing only the outer RPC executor still leaves the definer policy helper broken.
    await db.exec("grant usage on schema auth to fw_user_exec");
    await expect(call("get_me", {})).rejects.toMatchObject({ code: "42501", message: "permission denied for schema auth" });
    await db.exec("revoke usage on schema auth from fw_user_exec");
    const before = await boundary();
    await db.exec(correction);
    expect(await boundary()).toEqual(before);
    const usage = await db.query<{ allowed: boolean }>("select has_schema_privilege(name,'auth','USAGE') as allowed from (values ('fw_user_exec'),('fw_policy_exec')) r(name)");
    expect(usage.rows).toEqual([{ allowed: true }, { allowed: true }]);
    await expect(call("get_me", {})).rejects.toMatchObject({ code: "P0001", message: "NOT_FOUND" });
    const input = { displayName: "Synthetic grant regression", locale: "en", timeZone: "UTC", idempotencyKey: crypto.randomUUID() };
    expect(await call("create_profile", input)).toMatchObject({ id: actor, revision: 1, capabilities: [] });
    expect(await call("get_me", {})).toMatchObject({ id: actor, revision: 1 });
    expect(await call("update_profile", { ...input, idempotencyKey: crypto.randomUUID(), expectedRevision: 1 })).toMatchObject({ id: actor, revision: 2 });
    const raw = await db.query<{ allowed: boolean }>("select has_table_privilege(name,'auth.users','SELECT,INSERT,UPDATE,DELETE') as allowed from (values ('fw_user_exec'),('fw_policy_exec')) r(name)");
    expect(raw.rows).toEqual([{ allowed: false }, { allowed: false }]);
  } finally {
    await db.close();
  }
});
