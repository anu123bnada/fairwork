import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

// PostgreSQL/WASM exercises actual SQL roles, RLS, grants and transactions.
// Only the Supabase-owned auth schema/JWT gateway is simulated here. These
// tests do NOT establish hosted Auth, PostgREST, Storage or concurrency behavior.
const db = new PGlite();
const A = "10000000-0000-4000-8000-000000000001";
const B = "10000000-0000-4000-8000-000000000002";
const EMPLOYER = "10000000-0000-4000-8000-000000000003";
const OPERATOR = "10000000-0000-4000-8000-000000000004";
type SqlRole = "authenticated" | "anon" | "service_role" | "fw_user_exec";

async function asActor<T>(subject: string | null, sql: string, params: unknown[] = [], role: SqlRole = "authenticated", extra: Record<string, unknown> = {}) {
  await db.exec("begin");
  try {
    await db.exec(`set local role ${role}`);
    await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: subject, role: role === "anon" ? "anon" : "authenticated", aal: "aal1", is_anonymous: false, ...extra })]);
    const result = await db.query<T>(sql, params);
    await db.exec("commit");
    return result;
  } catch (error) { await db.exec("rollback"); throw error; }
}
const input = (name: string) => ({ displayName: name, locale: "en", timeZone: "UTC", idempotencyKey: crypto.randomUUID() });
async function rpc(subject: string | null, name: "create_profile" | "get_me" | "update_profile", request: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const result = await asActor<{ result: { id: string; revision: number; capabilities: string[]; displayName: string } }>(subject, `select api.${name}($1::jsonb) as result`, [JSON.stringify(request)], "authenticated", extra);
  return result.rows[0]!.result;
}

beforeAll(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    insert into auth.users values ('${A}'),('${B}'),('${EMPLOYER}'),('${OPERATOR}');
  `);
  await db.exec(await readFile("supabase/migrations/202610070001_identity_foundation.sql", "utf8"));
  // Hosted executors cannot use the managed auth schema. Exercise the entire
  // existing security suite through the private scalar context helpers.
  await db.exec("revoke usage on schema auth from fw_user_exec, fw_policy_exec");
  await db.exec(await readFile("supabase/migrations/202610080002_identity_auth_context.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/202610090001_identity_rpc_execute.sql", "utf8"));
  for (const [id, name] of [[A, "Synthetic Worker A"], [B, "Synthetic Worker B"], [EMPLOYER, "Synthetic Employer"], [OPERATOR, "Synthetic Operator"]]) {
    await rpc(id!, "create_profile", input(name!));
  }
});
afterAll(async () => { await db.close(); });

describe("Day 1 PostgreSQL security", () => {
  it("creates a scalar DTO and atomically records one audit and receipt across retries", async () => {
    const subject = "10000000-0000-4000-8000-000000000005";
    await db.query("insert into auth.users(id) values ($1)", [subject]);
    const request = input("New release account");
    const created = await rpc(subject, "create_profile", request);
    expect(created).toEqual({ id: subject, displayName: request.displayName, locale: "en", timeZone: "UTC", revision: 1, capabilities: [] });
    expect(await rpc(subject, "create_profile", request)).toEqual(created);
    expect(await rpc(subject, "get_me", {})).toEqual(created);
    await expect(rpc(subject, "create_profile", { ...request, displayName: "Changed retry" })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    const counts = await db.query(`select
      (select count(*)::integer from private.audit_logs where actor_id=$1) as audits,
      (select count(*)::integer from private.command_receipts where actor_id=$1) as receipts`, [subject]);
    expect(counts.rows).toEqual([{ audits: 1, receipts: 1 }]);
  });
  it("owns all five tables with FORCE RLS and no runtime owner/BYPASSRLS", async () => {
    const tables = await db.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean; owner: string }>(`select c.relname,c.relrowsecurity,c.relforcerowsecurity,r.rolname as owner from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_roles r on r.oid=c.relowner where n.nspname='private' and c.relkind='r'`);
    expect(tables.rows).toHaveLength(5);
    for (const row of tables.rows) expect(row).toMatchObject({ relrowsecurity: true, relforcerowsecurity: true, owner: "fw_schema_owner" });
    const roles = await db.query<{ rolcanlogin: boolean; rolbypassrls: boolean; rolsuper: boolean }>("select rolcanlogin,rolbypassrls,rolsuper from pg_roles where rolname in ('fw_user_exec','fw_policy_exec','fw_schema_owner')");
    for (const role of roles.rows) expect(role).toEqual({ rolcanlogin: false, rolbypassrls: false, rolsuper: false });
    const membership = await db.query<{ member: boolean }>("select pg_has_role('authenticated','fw_user_exec','MEMBER') as member");
    expect(membership.rows[0]!.member).toBe(false);
    const policies = await db.query<{ policyname: string }>("select policyname from pg_policies where schemaname='private' order by policyname");
    expect(policies.rows.map(p=>p.policyname)).toEqual([
      "audit_user_insert","capabilities_policy_select","limits_user_insert","limits_user_select","limits_user_update",
      "profiles_policy_select","profiles_user_insert","profiles_user_select","profiles_user_update","receipts_user_insert","receipts_user_select",
    ]);
  });
  it("exposes exactly three fixed-search-path RPCs, without PUBLIC or anon execution", async () => {
    const functions = await db.query<{ proname: string; prosecdef: boolean; owner: string; proconfig: string[] }>(`select p.proname,p.prosecdef,r.rolname as owner,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname='api' order by p.proname`);
    expect(functions.rows.map(f => f.proname)).toEqual(["create_profile", "get_me", "update_profile"]);
    for (const fn of functions.rows) {
      expect(fn).toMatchObject({ prosecdef: true, owner: "fw_user_exec" });
      expect(fn.proconfig).toContain('search_path=""');
      for (const role of ["anon", "service_role"]) {
        const result = await db.query<{ allowed: boolean }>("select has_function_privilege($1,$2,'EXECUTE') as allowed", [role, `api.${fn.proname}(jsonb)`]);
        expect(result.rows[0]!.allowed).toBe(false);
      }
    }
  });
  it.each(["authenticated", "anon", "service_role"] as const)("denies every raw private-table verb to %s", async role => {
    for (const table of ["profiles","capability_assignments","audit_logs","command_receipts","rate_limit_buckets"]) {
      for (const verb of ["SELECT", "INSERT", "UPDATE", "DELETE"]) {
        const result = await db.query<{ allowed: boolean }>("select has_table_privilege($1,$2,$3) as allowed", [role,`private.${table}`,verb]);
        expect(result.rows[0]!.allowed).toBe(false);
      }
    }
    await expect(asActor(A,"select * from private.profiles",[],role)).rejects.toThrow(/permission denied/);
    await expect(asActor(A,"update private.profiles set account_state='active'",[],role)).rejects.toThrow(/permission denied/);
  });
  it("rejects NULL profile values at the RPC boundary", async () => {
    await expect(rpc(A,"create_profile",{...input("Null locale"),locale:null})).rejects.toThrow("VALIDATION_FAILED");
  });
  it("returns only caller DTO and refuses a cross-user selector or forged role", async () => {
    const result = await rpc(A,"get_me",{}, { user_metadata: { role: "ADMIN" } });
    expect(result.id).toBe(A); expect(result.capabilities).toEqual([]);
    expect(Object.keys(result).sort()).toEqual(["capabilities","displayName","id","locale","revision","timeZone"].sort());
    await expect(rpc(A,"get_me",{id:B})).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc(EMPLOYER,"get_me",{id:A})).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc(A,"update_profile",{...input("Attack"),expectedRevision:1,role:"ADMIN"})).rejects.toThrow("VALIDATION_FAILED");
    await expect(asActor(A,"select private.has_capability('authority_operator')")).rejects.toThrow(/permission denied/);
  });
  it("RLS still scopes the definer executor and prevents cross-owner updates", async () => {
    const rows = await asActor<{ id: string }>(A,"select id from private.profiles",[],"fw_user_exec");
    expect(rows.rows).toEqual([{id:A}]);
    const update = await asActor(A,"update private.profiles set display_name='Attack' where id=$1 returning id",[B],"fw_user_exec");
    expect(update.rows).toEqual([]);
    await expect(asActor(A,"update private.profiles set account_state='suspended' where id=$1",[A],"fw_user_exec")).rejects.toThrow(/permission denied/);
  });
  it("serializes versioned updates and reauthorizes same-key replay without another audit", async () => {
    const request = {...input("Synthetic Worker A Updated"),expectedRevision:1};
    expect((await rpc(A,"update_profile",request)).revision).toBe(2);
    expect((await rpc(A,"update_profile",request)).revision).toBe(2);
    await expect(rpc(A,"update_profile",{...request,displayName:"Changed body"})).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await expect(rpc(A,"update_profile",{...request,idempotencyKey:crypto.randomUUID()})).rejects.toThrow("VERSION_CONFLICT");
    const audit=await db.query<{ count: number }>("select count(*)::integer as count from private.audit_logs where actor_id=$1 and action='update_profile'",[A]);
    expect(audit.rows[0]!.count).toBe(1);
    await expect(asActor(A,"update private.audit_logs set reason_code='edited'",[],"fw_user_exec")).rejects.toThrow(/permission denied/);
  });
  it("reads capabilities only from protected rows with aal2 and live expiry/revocation", async () => {
    await db.query("insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at) values($1,'authority_operator',$2,'Synthetic role-boundary test',now()+interval '1 hour')",[OPERATOR,A]);
    expect((await rpc(OPERATOR,"get_me",{})).capabilities).toEqual([]);
    expect((await rpc(OPERATOR,"get_me",{}, {aal:"aal2"})).capabilities).toEqual(["authority_operator"]);
    await db.query("update private.capability_assignments set revoked_at=now() where subject_id=$1",[OPERATOR]);
    expect((await rpc(OPERATOR,"get_me",{}, {aal:"aal2"})).capabilities).toEqual([]);
    await expect(asActor(OPERATOR,"insert into private.capability_assignments(subject_id) values($1)",[OPERATOR])).rejects.toThrow(/permission denied/);
  });
  it("denies anonymous identities and suspended accounts, including rebootstrap and receipt replay", async () => {
    await expect(rpc(null,"get_me",{})).rejects.toThrow("AUTH_REQUIRED");
    await expect(rpc(B,"create_profile",input("Anonymous"),{is_anonymous:true})).rejects.toThrow("AUTH_REQUIRED");
    await db.query("update private.profiles set account_state='suspended' where id=$1",[B]);
    await expect(rpc(B,"get_me",{})).rejects.toThrow("NOT_FOUND");
    await expect(rpc(B,"create_profile",input("Reactivation"))).rejects.toThrow("ACTION_FORBIDDEN");
  });
  it("enforces a shared read quota even through direct RPC calls", async () => {
    await db.query("delete from private.rate_limit_buckets where operation='identity_read'");
    for (let i=0;i<120;i++) await rpc(EMPLOYER,"get_me",{});
    await expect(rpc(EMPLOYER,"get_me",{})).rejects.toThrow("RATE_LIMITED");
  });
});
