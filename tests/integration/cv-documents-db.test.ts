import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Full migration chain on PGlite. Proves CV documents are owner-only, bounded, revision-checked and deletable by their owner.
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
const content = (over: Record<string, unknown> = {}) => ({ basics: { fullName: "Synthetic Person" }, summary: "Synthetic summary written by the person.", skills: ["Welding"], includeVerifiedWork: false, ...over });
const doc = (over: Record<string, unknown> = {}) => ({ id: randomUUID(), title: "General CV", template: "classic", targetRole: null, content: content(), expectedRevision: 0, ...over });

beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to anon,authenticated,service_role;");
  for (const file of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  for (const [id, label] of [[alice, "Alice"], [bob, "Bob"]]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into private.profiles(id,display_name) values($1,$2)", [id, label]);
  }
}, 120000);
afterAll(() => db.close());

describe("CV documents", () => {
  it("creates, reads back exactly what was saved, updates with the revision, and lists only the owner's documents", async () => {
    const first = doc();
    expect(await rpc("cv_save", first)).toEqual({ id: first.id, revision: 1 });
    const read = await rpc<{ content: unknown; revision: number; template: string }>("cv_read", { id: first.id });
    expect(read.content).toEqual(first.content);
    expect(read.revision).toBe(1);
    expect(await rpc("cv_save", { ...first, title: "Welder CV", template: "compact", targetRole: "Welder", expectedRevision: 1 })).toEqual({ id: first.id, revision: 2 });
    const list = await rpc<{ items: { id: string; title: string; template: string; targetRole: string | null }[] }>("cv_list", {});
    expect(list.items).toHaveLength(1);
    expect(list.items[0]).toMatchObject({ id: first.id, title: "Welder CV", template: "compact", targetRole: "Welder" });
    expect((await rpc<{ items: unknown[] }>("cv_list", {}, bob)).items).toEqual([]);
  });

  it("refuses stale revisions, other people's documents, invented top-level fields and oversize content", async () => {
    const mine = doc();
    await rpc("cv_save", mine);
    await expect(rpc("cv_save", { ...mine, expectedRevision: 5 })).rejects.toThrow("VERSION_CONFLICT");
    await expect(rpc("cv_save", { ...mine, expectedRevision: 1 }, bob)).rejects.toThrow("NOT_FOUND");
    await expect(rpc("cv_read", { id: mine.id }, bob)).rejects.toThrow("NOT_FOUND");
    await expect(rpc("cv_save", doc({ content: content({ verified: true }) }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("cv_save", doc({ content: content({ summary: "x".repeat(25000) }) }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("cv_save", { ...doc(), ownerId: bob })).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("cv_save", doc({ template: "fancy" }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("cv_save", doc({ title: "   " }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("cv_list", { ownerId: bob })).rejects.toThrow("VALIDATION_FAILED");
  });

  it("does not let a second person take over an existing id, and deletes only for the owner", async () => {
    const mine = doc();
    await rpc("cv_save", mine);
    await expect(rpc("cv_save", { ...mine, expectedRevision: 0 }, bob)).rejects.toThrow("NOT_FOUND");
    await expect(rpc("cv_delete", { id: mine.id }, bob)).rejects.toThrow("NOT_FOUND");
    expect(await rpc("cv_delete", { id: mine.id })).toEqual({ id: mine.id });
    await expect(rpc("cv_delete", { id: mine.id })).rejects.toThrow("NOT_FOUND");
    await expect(rpc("cv_read", { id: mine.id })).rejects.toThrow("NOT_FOUND");
  });

  it("keeps at most 20 documents per person", async () => {
    // The platform write quota stops 20 quick saves through the API, so earlier rows are seeded directly and the cap is checked on real saves.
    const existing = Number((await db.query<{ n: number }>("select count(*)::int n from private.cv_documents where owner_id=$1", [alice])).rows[0]!.n);
    for (let i = existing; i < 20; i++) await db.query("insert into private.cv_documents(id,owner_id,title,template,content,revision) values($1,$2,$3,'classic','{}',1)", [randomUUID(), alice, `Seeded ${i}`]);
    await expect(rpc("cv_save", doc())).rejects.toThrow("VALIDATION_FAILED");
    expect((await rpc<{ items: unknown[] }>("cv_list", {})).items).toHaveLength(20);
  });

  it("gives anonymous callers and direct table access nothing", async () => {
    const privilege = await db.query("select has_table_privilege('authenticated','private.cv_documents','SELECT') s,has_table_privilege('authenticated','private.cv_documents','INSERT') i,has_table_privilege('authenticated','private.cv_documents','UPDATE') u,has_table_privilege('authenticated','private.cv_documents','DELETE') d");
    expect(privilege.rows[0]).toEqual({ s: false, i: false, u: false, d: false });
    await db.exec("begin;set local role anon");
    await expect(db.query("select api.cv_list('{}'::jsonb)")).rejects.toThrow();
    await db.exec("rollback");
  });
});
