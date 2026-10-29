import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { localPostgresConnection } from "../local-postgres";

// Catalog-level security invariants over the COMPLETE migrated schema (every migration, in order). Individual migration tests prove their own functions; this
// catches the class of mistake where a later migration adds a table or function and forgets row-level security, a revoke, or a fixed search_path.
const db = process.env.FAIRWORK_LOCAL_POSTGRES_PORT ? await localPostgresConnection() : new PGlite();
afterAll(() => db.close());
beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;");
  for (const file of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
}, 240000);

// Deliberate exceptions, each with its reason. An exception that stops being needed fails the test, so the list cannot silently grow stale.
const ANON_EXECUTABLE: Record<string, string> = {
  "api.credential_status(jsonb)": "public verification of a credential's status by its identifier; returns status only",
  "api.developer_key_check(jsonb)": "server-to-server key check called before any user session exists; the key is the credential and only a hash is compared",
};
const NON_LOGIN_OWNER_EXEMPT: Record<string, string> = {
  "private.request_jwt()": "reads the request's JWT claims only; owned by the migration identity in every environment",
  "private.request_uid()": "reads the caller's subject from the same claims; no table access",
};
const CLIENT_ROLES = ["anon", "authenticated", "service_role"];
const rows = async <T>(sql: string) => (await db.query<T>(sql)).rows;

describe("complete schema security invariants", () => {
  it("every table in private has row-level security enabled and forced", async () => {
    const bad = await rows<{ t: string }>("select c.relname t from pg_class c where c.relnamespace='private'::regnamespace and c.relkind in ('r','p') and not (c.relrowsecurity and c.relforcerowsecurity) order by 1");
    expect(bad.map(r => r.t), "tables without enabled+forced RLS").toEqual([]);
  });
  it("no client role (anon, authenticated, service_role) or PUBLIC has any direct privilege on a private table, view or sequence", async () => {
    const bad: string[] = [];
    for (const r of await rows<{ t: string; k: string }>("select c.oid::regclass::text t, c.relkind k from pg_class c where c.relnamespace='private'::regnamespace and c.relkind in ('r','p','v','m','S')")) {
      for (const role of CLIENT_ROLES) {
        const privilege = r.k === "S" ? "USAGE" : "SELECT";
        const any = r.k === "S" ? [`has_sequence_privilege('${role}','${r.t}','USAGE')`] : ["SELECT", "INSERT", "UPDATE", "DELETE", "TRUNCATE", "REFERENCES", "TRIGGER"].map(p => `has_table_privilege('${role}','${r.t}','${p}')`);
        const ok = (await rows<{ x: boolean }>(`select (${any.join(" or ")}) x`))[0]!.x;
        if (ok) bad.push(`${role} -> ${r.t} (${privilege})`);
      }
      const acl = (await rows<{ a: string | null }>(`select relacl::text a from pg_class where oid='${r.t}'::regclass`))[0]!.a;
      if (acl && /[{,]=[a-zA-Z*]+\//.test(acl)) bad.push(`PUBLIC -> ${r.t}`);
    }
    expect(bad).toEqual([]);
  });
  it("no function in private or api is executable by anon, service_role or PUBLIC; private functions are not executable by authenticated", async () => {
    const bad: string[] = [], seen = new Set<string>();
    for (const r of await rows<{ f: string; s: string; acl: string | null }>("select p.oid::regprocedure::text f, n.nspname s, p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','api') and p.prokind in ('f','p')")) {
      if (!r.acl || /(^|[{,])=[a-zA-Z*]+\//.test(r.acl)) bad.push(`PUBLIC may execute ${r.f}${r.acl ? "" : " (default ACL)"}`);
      for (const role of ["anon", "service_role", ...(r.s === "private" ? ["authenticated"] : [])]) {
        if ((await rows<{ x: boolean }>(`select has_function_privilege('${role}','${r.f}','EXECUTE') x`))[0]!.x) { if (role === "anon" && ANON_EXECUTABLE[r.f]) seen.add(r.f); else bad.push(`${role} may execute ${r.f}`); }
      }
    }
    expect(bad).toEqual([]);
    expect([...seen].sort(), "listed anonymous exceptions that no longer exist").toEqual(Object.keys(ANON_EXECUTABLE).sort());
  });
  it("every SECURITY DEFINER function in private or api pins an empty search_path", async () => {
    const bad = await rows<{ f: string }>("select p.oid::regprocedure::text f from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','api') and p.prosecdef and not coalesce(array_to_string(p.proconfig,',') ilike '%search_path=\"\"%', false) order by 1");
    expect(bad.map(r => r.f)).toEqual([]);
  });
  it("no SECURITY DEFINER function in private or api is owned by a superuser or a login role", async () => {
    const bad = await rows<{ f: string; o: string }>("select p.oid::regprocedure::text f, r.rolname o from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner where n.nspname in ('private','api') and p.prosecdef and (r.rolsuper or r.rolcanlogin) order by 1");
    expect(bad.filter(r => !NON_LOGIN_OWNER_EXEMPT[r.f]).map(r => `${r.f} owned by ${r.o}`)).toEqual([]);
  });
  it("client roles cannot create objects in api or private, and the public schema offers them no create right", async () => {
    const bad: string[] = [];
    for (const role of CLIENT_ROLES) for (const schema of ["api", "private"]) if ((await rows<{ x: boolean }>(`select has_schema_privilege('${role}','${schema}','CREATE') x`))[0]!.x) bad.push(`${role} may CREATE in ${schema}`);
    for (const role of ["anon", "authenticated"]) if ((await rows<{ x: boolean }>(`select has_schema_privilege('${role}','private','USAGE') x`))[0]!.x) bad.push(`${role} may USAGE private`);
    expect(bad).toEqual([]);
  });
});
