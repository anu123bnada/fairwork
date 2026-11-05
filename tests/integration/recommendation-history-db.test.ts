import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Full migration chain on PGlite. Proves recommendation history is owner-only, minimal, idempotent, bounded to 50 and deletable by its owner.
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
const entry = (over: Record<string, unknown> = {}) => { const id = randomUUID(); return { entryId: id, listingId: randomUUID(), listingTitle: "Warehouse Assistant", companyName: "Synthetic Logistics", preferenceVersion: 1,
  reasons: [{ id: "role", outcome: "matches" }, { id: "location", outcome: "differs" }, { id: "payUnknown", outcome: "unknown" }], idempotencyKey: id, ...over }; };

beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant usage on schema auth to anon,authenticated,service_role;");
  for (const file of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  for (const [id, label] of [[alice, "Alice"], [bob, "Bob"]]) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into private.profiles(id,display_name) values($1,$2)", [id, label]);
  }
}, 120000);
afterAll(() => db.close());

describe("recommendation history", () => {
  it("saves a minimal snapshot, replays the same request without duplicating, and lists newest first for the owner only", async () => {
    const first = entry();
    expect(await rpc("recommendation_history_add", first)).toEqual({ entryId: first.entryId, replayed: false });
    expect(await rpc("recommendation_history_add", first)).toEqual({ entryId: first.entryId, replayed: true });
    await expect(rpc("recommendation_history_add", { ...entry(), idempotencyKey: first.idempotencyKey })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    const second = entry({ listingTitle: "Machine Operator" });
    await rpc("recommendation_history_add", second);
    const own = await rpc<{ items: { entryId: string; listingTitle: string; reasons: unknown[] }[] }>("recommendation_history_list", {});
    expect(own.items.map(i => i.entryId)).toEqual([second.entryId, first.entryId]);
    expect(Object.keys(own.items[0]!).sort()).toEqual(["companyName", "createdAt", "entryId", "listingId", "listingTitle", "preferenceVersion", "reasons"]);
    expect((await rpc<{ items: unknown[] }>("recommendation_history_list", {}, bob)).items).toEqual([]);
  });

  it("rejects extra fields, invented reason ids or outcomes, free text in reasons, too many reasons, and a client-supplied owner", async () => {
    await expect(rpc("recommendation_history_add", { ...entry(), ownerId: bob })).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("recommendation_history_add", entry({ reasons: [{ id: "salary", outcome: "matches" }] }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("recommendation_history_add", entry({ reasons: [{ id: "role", outcome: "great fit" }] }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("recommendation_history_add", entry({ reasons: [{ id: "role", outcome: "matches", detail: "Your preference: nurse" }] }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("recommendation_history_add", entry({ reasons: Array.from({ length: 6 }, () => ({ id: "role", outcome: "matches" })) }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("recommendation_history_add", entry({ listingTitle: "   " }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("recommendation_history_list", { ownerId: bob })).rejects.toThrow("VALIDATION_FAILED");
  });

  it("lets only the owner delete an entry and keeps at most 50, dropping the oldest", async () => {
    const mine = entry();
    await rpc("recommendation_history_add", mine);
    await expect(rpc("recommendation_history_delete", { entryId: mine.entryId }, bob)).rejects.toThrow("NOT_FOUND");
    expect(await rpc("recommendation_history_delete", { entryId: mine.entryId })).toEqual({ entryId: mine.entryId });
    await expect(rpc("recommendation_history_delete", { entryId: mine.entryId })).rejects.toThrow("NOT_FOUND");
    // The platform's write quota (RATE_LIMITED) stops a person adding 52 entries quickly, so the older rows are seeded directly and the cap is checked on one real add.
    for (let i = 0; i < 52; i++) await db.query("insert into private.recommendation_history(id,owner_id,listing_id,listing_title,preference_version,reasons,idempotency_key,created_at) values($1,$2,$3,$4,1,'[]',$5,$6)", [randomUUID(), alice, randomUUID(), `Seeded ${i}`, randomUUID(), new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString()]);
    await rpc("recommendation_history_add", entry({ listingTitle: "Newest" }));
    const kept = await rpc<{ items: { listingTitle: string }[] }>("recommendation_history_list", {});
    expect(kept.items).toHaveLength(50);
    expect(kept.items[0]!.listingTitle).toBe("Newest");
    expect(kept.items.some(i => i.listingTitle === "Seeded 0")).toBe(false);
  }, 120000);

  it("gives anonymous callers and direct table access nothing", async () => {
    const privilege = await db.query("select has_table_privilege('authenticated','private.recommendation_history','SELECT') s,has_table_privilege('authenticated','private.recommendation_history','INSERT') i,has_table_privilege('authenticated','private.recommendation_history','DELETE') d");
    expect(privilege.rows[0]).toEqual({ s: false, i: false, d: false });
    await db.exec("begin;set local role anon");
    await expect(db.query("select api.recommendation_history_list('{}'::jsonb)")).rejects.toThrow();
    await db.exec("rollback");
  });
});
