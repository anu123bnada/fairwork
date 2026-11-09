import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Full migration chain on PGlite. Proves personal records (applications and projects) are owner-only, validated per kind, revision-checked, bounded and deletable by their owner.
const db = new PGlite();
const alice = randomUUID(), bob = randomUUID();
const claims = (id: string) => ({ sub: id, role: "authenticated", aal: "aal2", is_anonymous: false });
async function rpc<T = Record<string, unknown>>(name: string, body: unknown, id = alice) {
  await db.exec("begin;set local role authenticated");
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(claims(id))]);
    const result = await db.query<{ r: T }>(`select api.${name}($1::jsonb) r`, [JSON.stringify(body)]);
    await db.exec("commit");
    return result.rows[0]!.r;
  } catch (error) { await db.exec("rollback"); throw error; }
}
const application = (over: Record<string, unknown> = {}) => ({ id: randomUUID(), kind: "application", title: "Warehouse Assistant", status: "applied",
  content: { organization: "DEMO Stores", appliedOn: "2026-11-01", nextStepAt: "2026-11-12", notes: "Applied online", events: [{ id: randomUUID(), kind: "interview", at: "2026-11-12T09:00", notes: "Phone" }], prep: [true, false] }, expectedRevision: 0, ...over });
const project = (over: Record<string, unknown> = {}) => ({ id: randomUUID(), kind: "project", title: "Workshop tidy-up", status: "active",
  content: { description: "Organise the tools", dueOn: "2026-12-01", milestones: [{ id: randomUUID(), title: "Sort tools", done: true }], tasks: [{ id: randomUUID(), title: "Label shelves", done: true }, { id: randomUUID(), title: "Clean bench", done: false }] }, expectedRevision: 0, ...over });

beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to anon,authenticated,service_role;");
  for (const file of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  for (const [id, label] of [[alice, "Alice"], [bob, "Bob"]]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into private.profiles(id,display_name) values($1,$2)", [id, label]);
  }
}, 120000);
afterAll(() => db.close());

describe("personal records", () => {
  it("saves, reads back exactly, updates with the revision, and lists per kind with a summary, only for the owner", async () => {
    const app = application(), proj = project();
    expect(await rpc("personal_record_save", app)).toEqual({ id: app.id, revision: 1 });
    expect(await rpc("personal_record_save", proj)).toEqual({ id: proj.id, revision: 1 });
    expect((await rpc<{ content: unknown; status: string }>("personal_record_read", { id: app.id })).content).toEqual(app.content);
    expect(await rpc("personal_record_save", { ...app, status: "interviewing", expectedRevision: 1 })).toEqual({ id: app.id, revision: 2 });
    const apps = await rpc<{ items: { id: string; status: string; summary: Record<string, unknown> }[] }>("personal_record_list", { kind: "application" });
    expect(apps.items).toHaveLength(1);
    expect(apps.items[0]).toMatchObject({ id: app.id, status: "interviewing" });
    expect(apps.items[0]!.summary).toMatchObject({ organization: "DEMO Stores", nextStepAt: "2026-11-12", eventCount: 1 });
    const projects = await rpc<{ items: { summary: Record<string, unknown> }[] }>("personal_record_list", { kind: "project" });
    expect(projects.items[0]!.summary).toMatchObject({ taskCount: 2, tasksDone: 1 });
    expect((await rpc<{ items: unknown[] }>("personal_record_list", { kind: "application" }, bob)).items).toEqual([]);
  });

  it("enforces the status list per kind, allowed content keys per kind, size, and no client-supplied owner", async () => {
    await expect(rpc("personal_record_save", application({ status: "active" }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("personal_record_save", project({ status: "applied" }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("personal_record_save", application({ content: { organization: "x", tasks: [] } }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("personal_record_save", project({ content: { description: "x", events: [] } }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("personal_record_save", application({ content: { notes: "x".repeat(41000) } }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("personal_record_save", { ...application(), ownerId: bob })).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("personal_record_save", application({ kind: "invoice" }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("personal_record_save", application({ title: "  " }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("personal_record_list", { kind: "invoice" })).rejects.toThrow("VALIDATION_FAILED");
  });

  it("refuses stale revisions, other people's records and changing a record's kind, and deletes only for the owner", async () => {
    const app = application();
    await rpc("personal_record_save", app);
    await expect(rpc("personal_record_save", { ...app, expectedRevision: 5 })).rejects.toThrow("VERSION_CONFLICT");
    await expect(rpc("personal_record_save", { ...app, expectedRevision: 1 }, bob)).rejects.toThrow("NOT_FOUND");
    await expect(rpc("personal_record_save", { ...app, kind: "project", status: "active", expectedRevision: 1 })).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("personal_record_read", { id: app.id }, bob)).rejects.toThrow("NOT_FOUND");
    await expect(rpc("personal_record_delete", { id: app.id }, bob)).rejects.toThrow("NOT_FOUND");
    expect(await rpc("personal_record_delete", { id: app.id })).toEqual({ id: app.id });
    await expect(rpc("personal_record_read", { id: app.id })).rejects.toThrow("NOT_FOUND");
  });

  it("keeps at most 100 per kind per person", async () => {
    const existing = Number((await db.query<{ n: number }>("select count(*)::int n from private.personal_records where owner_id=$1 and kind='project'", [alice])).rows[0]!.n);
    for (let i = existing; i < 100; i++) await db.query("insert into private.personal_records(id,owner_id,kind,title,status,content,revision) values($1,$2,'project',$3,'planned','{}',1)", [randomUUID(), alice, `Seeded ${i}`]);
    await expect(rpc("personal_record_save", project())).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("personal_record_save", application())).resolves.toBeDefined();
  });

  it("gives anonymous callers and direct table access nothing", async () => {
    const p = await db.query("select has_table_privilege('authenticated','private.personal_records','SELECT') s,has_table_privilege('authenticated','private.personal_records','INSERT') i,has_table_privilege('authenticated','private.personal_records','UPDATE') u,has_table_privilege('authenticated','private.personal_records','DELETE') d");
    expect(p.rows[0]).toEqual({ s: false, i: false, u: false, d: false });
    await db.exec("begin;set local role anon");
    await expect(db.query("select api.personal_record_list('{\"kind\":\"application\"}'::jsonb)")).rejects.toThrow();
    await db.exec("rollback");
  });
});
