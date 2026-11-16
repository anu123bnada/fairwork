import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { emptyCareerProfile, emptyFeedback, emptyRoadmap, recordDocument, recordList } from "@/features/records/schema";

// Full migration chain on PGlite. Proves the career profile and opportunity feedback kinds are owner-only, validated per kind, and that what the database returns still fits the strict schemas the app re-parses it with.
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

describe("career profile and opportunity feedback kinds", () => {
  it("saves, reads and lists both kinds in a shape the strict app schemas accept, and keeps them private to the owner", async () => {
    const profile = make("career_profile", "active", { ...emptyCareerProfile, primaryGoal: { careerId: "junior-web-developer", title: "Junior web developer" }, skills: [{ id: randomUUID(), name: "HTML", kind: "technical", evidence: "demonstrated", note: "Built a one-page site" }], progress: [{ resourceId: "webdev-learn-html", status: "completed", updatedOn: "2026-11-16", evidenceLink: "https://example.test/cert" }] });
    const feedback = make("opportunity_feedback", "active", { entries: [{ listingId: randomUUID(), action: "like", at: "2026-11-16T09:00:00Z" }] });
    for (const doc of [profile, feedback]) {
      expect(await rpc("personal_record_save", doc)).toEqual({ id: doc.id, revision: 1 });
      expect(recordDocument.parse(await rpc("personal_record_read", { id: doc.id })).content).toEqual(doc.content);
      expect(recordList.parse(await rpc("personal_record_list", { kind: doc.kind })).items.map(item => item.id)).toEqual([doc.id]);
      expect(recordList.parse(await rpc("personal_record_list", { kind: doc.kind }, bob)).items).toEqual([]);
      await expect(rpc("personal_record_read", { id: doc.id }, bob)).rejects.toThrow(/NOT_FOUND/);
    }
    expect(await rpc("personal_record_save", { ...profile, expectedRevision: 1 })).toEqual({ id: profile.id, revision: 2 });
    await expect(rpc("personal_record_save", { ...profile, expectedRevision: 1 })).rejects.toThrow(/VERSION_CONFLICT/);
  });
  it("refuses a status or key that does not belong to the kind and the older kinds still work", async () => {
    await expect(rpc("personal_record_save", make("career_profile", "draft", { ...emptyCareerProfile }))).rejects.toThrow(/VALIDATION_FAILED/);
    await expect(rpc("personal_record_save", make("career_profile", "active", { ...emptyCareerProfile, verified: true }))).rejects.toThrow(/VALIDATION_FAILED/);
    await expect(rpc("personal_record_save", make("opportunity_feedback", "archived", { ...emptyFeedback }))).rejects.toThrow(/VALIDATION_FAILED/);
    await expect(rpc("personal_record_save", make("opportunity_feedback", "active", { entries: [], extra: 1 }))).rejects.toThrow(/VALIDATION_FAILED/);
    expect(await rpc("personal_record_save", make("roadmap", "active", { ...emptyRoadmap, careerId: "welder" }))).toMatchObject({ revision: 1 });
  });
  it("lets the owner delete a record and nobody else", async () => {
    const doc = make("opportunity_feedback", "active", { entries: [] });
    await rpc("personal_record_save", doc);
    await expect(rpc("personal_record_delete", { id: doc.id }, bob)).rejects.toThrow(/NOT_FOUND/);
    expect(await rpc("personal_record_delete", { id: doc.id })).toEqual({ id: doc.id });
  });
});
