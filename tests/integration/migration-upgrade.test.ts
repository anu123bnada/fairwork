import { afterAll, beforeAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { localPostgresConnection } from "../local-postgres";

// Rehearsal of the hosted upgrade. The staging project has the first 32 migrations applied and holds data; 19 migrations were pending then (they have since been applied there); every later migration, 23 in total at present, is rehearsed the same way. This applies the first
// 32 to a fresh database, writes synthetic rows, then applies the remaining 23 in order and checks that: every migration applies cleanly on top of existing
// data, no existing row was changed or lost, and everything the pending migrations added is protected (row-level security enabled and forced, no direct
// client grants, no function callable by the public or anonymous roles).
const APPLIED_ON_STAGING = "20261024053156";
const db = process.env.FAIRWORK_LOCAL_POSTGRES_PORT ? await localPostgresConnection() : new PGlite();
const user = randomUUID(), other = randomUUID();
let files: string[] = [];
let before: Record<string, number> = {};
let tablesBefore = new Set<string>(), functionsBefore = new Set<string>();

const privateCounts = async () => {
  const names = (await db.query<{ t: string }>("select c.relname t from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r' order by 1")).rows.map(row => row.t);
  const out: Record<string, number> = {};
  for (const name of names) out[name] = Number((await db.query<{ n: string }>(`select count(*) n from private.${name}`)).rows[0]!.n);
  return out;
};

beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;");
  files = (await readdir("supabase/migrations")).sort();
  const applied = files.filter(file => file.split("_")[0]! <= APPLIED_ON_STAGING);
  for (const file of applied) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  for (const [id, name] of [[user, "Existing staging user"], [other, "Another existing user"]] as const) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into private.profiles(id,display_name) values($1,$2)", [id, name]);
  }
  await db.query("insert into private.admin_roles(subject_id,role,expires_at,revision) values($1,'owner',now()+interval '1 day',1)", [user]);
  before = await privateCounts();
  tablesBefore = new Set((await db.query<{ t: string }>("select c.relname t from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r'")).rows.map(row => row.t));
  functionsBefore = new Set((await db.query<{ f: string }>("select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('api','private')")).rows.map(row => row.f));
}, 240000);
afterAll(() => db.close());

it("starts from the staging state: 32 migrations, with real rows present", async () => {
  expect(files.filter(file => file.split("_")[0]! <= APPLIED_ON_STAGING)).toHaveLength(32);
  expect(files.filter(file => file.split("_")[0]! > APPLIED_ON_STAGING)).toHaveLength(23);
  expect(before.profiles).toBe(2);
});

it("applies the 23 pending migrations in order on top of existing data without error", async () => {
  const pending = files.filter(file => file.split("_")[0]! > APPLIED_ON_STAGING);
  for (const file of pending) {
    try { await db.exec(await readFile(`supabase/migrations/${file}`, "utf8")); }
    catch (error) { throw new Error(`Pending migration ${file} failed on top of existing data: ${(error as Error).message}`, { cause: error }); }
  }
}, 240000);

it("changes no existing row: every table that held data has exactly the same row count and the seeded rows are intact", async () => {
  const after = await privateCounts();
  for (const [table, count] of Object.entries(before)) expect(after[table], `rows in private.${table}`).toBe(count);
  const profiles = (await db.query<{ id: string; display_name: string }>("select id, display_name from private.profiles order by display_name")).rows;
  expect(profiles.map(row => row.display_name)).toEqual(["Another existing user", "Existing staging user"]);
  expect((await db.query("select 1 from private.admin_roles where subject_id=$1 and role='owner'", [user])).rows).toHaveLength(1);
});

it("protects everything the pending migrations added: RLS enabled and forced, no client grants, no public execute", async () => {
  const added = (await db.query<{ t: string; rls: boolean; forced: boolean }>(
    "select c.relname t, c.relrowsecurity rls, c.relforcerowsecurity forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relkind='r'")).rows.filter(row => !tablesBefore.has(row.t));
  expect(added.length).toBeGreaterThanOrEqual(15);
  for (const table of added) {
    expect(table.rls, `RLS on private.${table.t}`).toBe(true);
    expect(table.forced, `forced RLS on private.${table.t}`).toBe(true);
    const grants = (await db.query<{ grantee: string }>("select grantee from information_schema.role_table_grants where table_schema='private' and table_name=$1 and grantee in ('anon','authenticated','PUBLIC','service_role')", [table.t])).rows;
    expect(grants, `direct client grants on private.${table.t}`).toEqual([]);
  }
  const fresh = (await db.query<{ f: string; name: string; schema: string }>("select p.oid::regprocedure::text f, p.proname name, n.nspname schema from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('api','private')")).rows.filter(row => !functionsBefore.has(row.f));
  expect(fresh.length).toBeGreaterThan(20);
  // Two functions are public by design because their callers have no session, and each is documented as such in its migration: the credential status check
  // (answers only status, reason and time) and the developer key check (answers only whether a key id and secret hash pair is valid). Both are exercised end to
  // end in the real-stack harness. Any other new function reachable by anon or PUBLIC fails this list.
  const anonymous: string[] = [], everyone: string[] = [];
  for (const fn of fresh) {
    const callable = (await db.query<{ anon: boolean; pub: boolean }>(
      "select has_function_privilege('anon', $1::regprocedure, 'EXECUTE') anon, exists(select 1 from aclexplode(coalesce((select proacl from pg_proc where oid=$1::regprocedure), acldefault('f',(select proowner from pg_proc where oid=$1::regprocedure)))) a where a.grantee=0 and a.privilege_type='EXECUTE') pub", [fn.f])).rows[0]!;
    if (callable.anon) anonymous.push(fn.f);
    if (callable.pub) everyone.push(fn.f);
  }
  expect(everyone, "functions executable by PUBLIC").toEqual([]);
  expect(anonymous, "functions executable by the anonymous role").toEqual(["api.credential_status(jsonb)", "api.developer_key_check(jsonb)"]);
});

it("never lets an anonymous or authenticated client read the new private tables directly", async () => {
  for (const table of ["offer_notes", "vault_documents", "abuse_reports", "developer_keys", "org_plan_assignments"]) {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      let denied = false;
      try { await db.query(`select 1 from private.${table} limit 1`); } catch { denied = true; }
      await db.exec("reset role");
      expect(denied, `${role} read private.${table}`).toBe(true);
    }
  }
});
