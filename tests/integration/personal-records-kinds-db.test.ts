import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { emptyApplication, emptyCoverLetter, emptyPortfolio, emptyProject, emptyRoadmap, recordDocument, recordList } from "@/features/records/schema";

// Full migration chain on PGlite. Proves the five record kinds are owner-only, validated per kind, and that what the database returns still fits the strict schemas the app re-parses it with.
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
const make = (kind: string, status: string, content: Record<string, unknown>, over: Record<string, unknown> = {}) => ({ id: randomUUID(), kind, title: `Synthetic ${kind}`, status, content, expectedRevision: 0, ...over });

beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to anon,authenticated,service_role;");
  for (const file of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  for (const [id, label] of [[alice, "Alice"], [bob, "Bob"]]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into private.profiles(id,display_name) values($1,$2)", [id, label]);
  }
}, 120000);
afterAll(async () => { await db.close(); });

describe("personal records: all five kinds", () => {
  it("saves each kind, reads it back and lists it in a shape the strict app schemas accept", async () => {
    const docs = [
      make("application", "applied", { ...emptyApplication, organization: "DEMO Stores", appliedOn: "2026-11-01", nextStepAt: "2026-11-12T09:30" }),
      make("project", "active", { ...emptyProject, dueOn: "2026-12-01", milestones: [{ id: randomUUID(), title: "M1", done: true, dueOn: "" }], tasks: [{ id: randomUUID(), title: "T1", done: true }, { id: randomUUID(), title: "T2", done: false }] }),
      make("cover_letter", "draft", { ...emptyCoverLetter, organization: "DEMO Stores", role: "Cashier", body: "Dear team," }),
      make("portfolio", "ready", { ...emptyPortfolio, category: "certificate", link: "https://example.test/cert", summary: "Safety course", skills: ["Safe work"], date: "2026-10-01" }),
      make("roadmap", "active", { ...emptyRoadmap, careerId: "welder", milestones: [{ id: randomUUID(), title: "Learn MIG welding", skill: "MIG welding", done: false, dueOn: "2026-12-15" }, { id: randomUUID(), title: "Safety course", skill: "Safe work", done: true, dueOn: "" }] }),
    ];
    for (const doc of docs) {
      expect(await rpc("personal_record_save", doc)).toEqual({ id: doc.id, revision: 1 });
      const read = recordDocument.parse(await rpc("personal_record_read", { id: doc.id }));
      expect(read.content).toEqual(doc.content);
      const list = recordList.parse(await rpc("personal_record_list", { kind: doc.kind }));
      expect(list.items.map(item => item.id)).toEqual([doc.id]);
    }
    const project = recordList.parse(await rpc("personal_record_list", { kind: "project" })).items[0]!;
    expect(project.summary).toMatchObject({ taskCount: 2, tasksDone: 1, milestoneCount: 1, milestonesDone: 1 });
    const roadmap = recordList.parse(await rpc("personal_record_list", { kind: "roadmap" })).items[0]!;
    expect(roadmap.summary).toMatchObject({ careerId: "welder", milestoneCount: 2, milestonesDone: 1 });
    expect(recordList.parse(await rpc("personal_record_list", { kind: "portfolio" })).items[0]!.summary.category).toBe("certificate");
  });
  it("refuses a status that belongs to another kind, a key that is not allowed for the kind, and an unknown kind", async () => {
    await expect(rpc("personal_record_save", make("cover_letter", "active", { ...emptyCoverLetter }))).rejects.toThrow(/VALIDATION_FAILED/);
    await expect(rpc("personal_record_save", make("portfolio", "draft", { ...emptyCoverLetter }))).rejects.toThrow(/VALIDATION_FAILED/);
    await expect(rpc("personal_record_save", make("roadmap", "active", { ...emptyRoadmap, verified: true }))).rejects.toThrow(/VALIDATION_FAILED/);
    await expect(rpc("personal_record_save", make("diary", "draft", {}))).rejects.toThrow(/VALIDATION_FAILED/);
    await expect(rpc("personal_record_list", { kind: "diary" })).rejects.toThrow(/VALIDATION_FAILED/);
  });
  it("keeps every kind owner-only: another account cannot list, read, update or delete", async () => {
    const doc = make("cover_letter", "final", { ...emptyCoverLetter, body: "Private" });
    await rpc("personal_record_save", doc);
    expect((await rpc<{ items: unknown[] }>("personal_record_list", { kind: "cover_letter" }, bob)).items).toEqual([]);
    await expect(rpc("personal_record_read", { id: doc.id }, bob)).rejects.toThrow(/NOT_FOUND/);
    await expect(rpc("personal_record_save", { ...doc, expectedRevision: 1 }, bob)).rejects.toThrow(/NOT_FOUND/);
    await expect(rpc("personal_record_delete", { id: doc.id }, bob)).rejects.toThrow(/NOT_FOUND/);
    expect(await rpc("personal_record_delete", { id: doc.id })).toEqual({ id: doc.id });
  });
  it("is not executable anonymously", async () => {
    await db.exec("begin;set local role anon");
    try { await expect(db.query("select api.personal_record_list('{\"kind\":\"project\"}'::jsonb)")).rejects.toThrow(/permission denied/i); } finally { await db.exec("rollback"); }
  });
});
