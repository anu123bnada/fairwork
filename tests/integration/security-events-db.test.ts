import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Full migration chain on PGlite. Proves the own-security-activity function is owner-scoped, limited to four event kinds, bounded and read-only.
const db = new PGlite();
const alice = randomUUID(), bob = randomUUID();
const claims = (id: string) => ({ sub: id, role: "authenticated", aal: "aal2", is_anonymous: false });
async function events(id: string, body: unknown = {}) {
  await db.exec("begin;set local role authenticated");
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(claims(id))]);
    const result = await db.query<{ r: { items: { kind: string; occurredAt: string }[]; limit: number } }>("select api.security_events_list($1::jsonb) r", [JSON.stringify(body)]);
    await db.exec("commit");
    return result.rows[0]!.r;
  } catch (error) { await db.exec("rollback"); throw error; }
}
const insert = (subject: string | null, kind: string, at: string) =>
  db.query("insert into private.runtime_events(id,kind,subject_id,operation,created_at) values($1,$2,$3,'auth.test',$4)", [randomUUID(), kind, subject, at]);

beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to anon,authenticated,service_role;");
  for (const file of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  for (const [id, label] of [[alice, "Alice"], [bob, "Bob"]]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into private.profiles(id,display_name) values($1,$2)", [id, label]);
  }
}, 120000);
afterAll(() => db.close());

describe("own security activity", () => {
  it("returns only the caller's own sign-in, second-factor, sign-out and password events, newest first, with kind and time only", async () => {
    await insert(alice, "login_success", "2026-11-01T08:00:00Z");
    await insert(alice, "mfa_success", "2026-11-01T08:00:20Z");
    await insert(alice, "password_changed", "2026-11-02T09:00:00Z");
    await insert(alice, "logout_success", "2026-11-03T10:00:00Z");
    await insert(bob, "login_success", "2026-11-04T10:00:00Z");
    const own = await events(alice);
    expect(own.items.map(i => i.kind)).toEqual(["logout_success", "password_changed", "mfa_success", "login_success"]);
    expect(Object.keys(own.items[0]!).sort()).toEqual(["kind", "occurredAt"]);
    expect((await events(bob)).items.map(i => i.kind)).toEqual(["login_success"]);
  });

  it("excludes unattributed failures and non-security kinds, and is capped at 30", async () => {
    await insert(null, "login_failure", "2026-11-05T01:00:00Z");
    await insert(alice, "api_failure", "2026-11-05T02:00:00Z");
    await insert(alice, "ai_attempt", "2026-11-05T03:00:00Z").catch(() => undefined);
    for (let i = 0; i < 40; i++) await insert(alice, "login_success", new Date(Date.UTC(2026, 10, 6, 0, i)).toISOString());
    const own = await events(alice);
    expect(own.items).toHaveLength(30);
    expect(own.items.every(i => ["login_success", "mfa_success", "logout_success", "password_changed"].includes(i.kind))).toBe(true);
    expect(own.limit).toBe(30);
  });

  it("rejects extra input such as a client-supplied identity, and gives anonymous callers no access", async () => {
    await expect(events(alice, { subjectId: bob })).rejects.toThrow("VALIDATION_FAILED");
    await expect(db.query("select api.security_events_list('{}'::jsonb)")).rejects.toThrow("AUTH_REQUIRED");
    await db.exec("begin;set local role anon");
    await expect(db.query("select api.security_events_list('{}'::jsonb)")).rejects.toThrow();
    await db.exec("rollback");
  });

  it("does not let the signed-in role read or change the telemetry table directly", async () => {
    const privilege = await db.query("select has_table_privilege('authenticated','private.runtime_events','SELECT') s,has_table_privilege('authenticated','private.runtime_events','INSERT') i,has_table_privilege('authenticated','private.runtime_events','DELETE') d");
    expect(privilege.rows[0]).toEqual({ s: false, i: false, d: false });
    await db.exec("begin;set local role fw_user_exec");
    await expect(db.query("update private.runtime_events set kind='login_success'")).rejects.toThrow();
    await db.exec("rollback");
  });
});
