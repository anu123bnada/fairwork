import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { localPostgresConnection } from "../local-postgres";
import { twoAccountFlow } from "../../scripts/hosted-two-account-flow.mjs";

// REVIEW-ONLY rehearsal of the PROPOSED batch 7 (docs/proposed-migrations/*.sql). The three files are applied on top of every real migration in a disposable database;
// nothing here touches supabase/migrations or any hosted system. Realtime is replaced by a stub of the `realtime` schema (messages, send, topic), so section C proves the
// shape, privacy and fan-out of the signals but NOT the hosted Realtime service, which must be verified separately with two real accounts.
const db = process.env.FAIRWORK_LOCAL_POSTGRES_PORT ? await localPostgresConnection() : new PGlite();
afterAll(() => db.close());
const operator = randomUUID(), rep = randomUUID(), worker = randomUUID(), recipient = randomUUID(), stranger = randomUUID();
let company = "", journey: { offerId: string; agreementId: string; workId: string };

async function rpc<T = Record<string, unknown>>(name: string, request: unknown, actor: string | null = worker, aal = "aal2"): Promise<T> {
  await db.exec("begin; set local role authenticated");
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: actor, role: "authenticated", aal, is_anonymous: false, amr: [{ method: "totp", timestamp: Math.floor(Date.now() / 1000) }] })]);
    const result = await db.query<{ data: T }>(`select api.${name}($1::jsonb) data`, [JSON.stringify(request)]);
    await db.exec("commit");
    return result.rows[0]!.data;
  } catch (error) { await db.exec("rollback"); throw error; }
}
const superuser = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => { await db.exec("reset role"); return (await db.query<T>(sql, params)).rows; };
const clearQuotas = async () => { await superuser("delete from private.rate_limit_buckets"); };
const apply = async (file: string) => { await db.exec("reset role"); await db.exec(await readFile(`docs/proposed-migrations/${file}`, "utf8")); };

beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;");
  // Stub of the hosted Realtime schema, just enough for the proposed SQL and its policy.
  await db.exec(`create schema realtime;
    create table realtime.messages(id bigserial primary key, topic text not null, extension text not null default 'broadcast', event text, payload jsonb, private boolean default true);
    grant usage on schema realtime to authenticated; grant select on realtime.messages to authenticated;
    create function realtime.topic() returns text language sql stable as $$select nullif(current_setting('realtime.topic',true),'')$$;
    create function realtime.send(payload jsonb,event text,topic text,private boolean default true) returns void language sql security definer as $$insert into realtime.messages(topic,event,payload,private) values(topic,event,payload,private)$$;`);
  for (const file of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.exec("alter table realtime.messages owner to postgres");
  for (const file of ["20261030100000_passport_access_log.sql", "20261030110000_qualifications.sql", "20261030120000_realtime_signals.sql"]) await apply(file);
  for (const id of [operator, rep, worker, recipient, stranger]) { await db.query("insert into auth.users values($1)", [id]); await db.query("insert into private.profiles(id,display_name) values($1,'Synthetic batch 7')", [id]); }
  await db.query("insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at) values($1,'authority_operator',$2,'Synthetic test only',now()+interval '1 day')", [operator, stranger]);
  company = (await rpc("provision_company", { name: "Synthetic batch 7 company", idempotencyKey: randomUUID() }, operator)).id as string;
  await rpc("decide_membership", { companyId: company, subjectId: rep, decision: "approve", expectedRevision: 0, expiresAt: new Date(Date.now() + 86400000).toISOString(), reviewedEvidenceRefs: ["demo:fixture/batch7"], reason: "Synthetic batch 7 authority", policyVersion: "demo-authority.v1", idempotencyKey: randomUUID() }, operator);
  const map: Record<string, [string, string]> = { "/api/v1/offers": ["review_offer", ""], "/api/v1/agreement-workflows": ["agreement_workflow", "read_agreement_workflow"], "/api/v1/work-records": ["work_command", "read_work"], "/api/v1/passport": ["initialize_passport", "read_passport"], "/api/v1/agreements": ["", "get_agreement"] };
  journey = await twoAccountFlow({
    worker: { id: worker }, employer: { id: rep }, companyId: company, record: () => undefined,
    request: async (who: { id: string }, path: string, body?: unknown, statuses: number[] = [200]) => {
      const url = new URL(path, "https://local-test.invalid"), entry = map[url.pathname];
      if (!entry) throw new Error(`Unmapped ${url.pathname}`);
      const name = body ? entry[0] : entry[1];
      if (url.pathname === "/api/v1/passport" && !body && url.search && statuses.includes(422)) return;
      try { return await rpc(name, body ?? (url.searchParams.size ? Object.fromEntries(url.searchParams) : { cursor: null }), who.id); }
      catch (error) { if (statuses.includes(403) && String(error).includes("ACTION_FORBIDDEN")) return; throw error; }
    },
  });
}, 300000);

describe("A. Passport access log and notifications", () => {
  let grant = "", item = "";
  const fields = ["task_summary", "verification_status"];
  const view = (actor: string, id = grant, mode = "recipient") => rpc<{ entries: unknown[]; active: boolean }>("passport_projection", { grantId: id, mode }, actor);
  const logRows = async (id = grant) => (await superuser<{ n: string }>("select count(*)::text n from private.passport_access_log where grant_id=$1", [id]))[0]!.n;
  it("logs each successful recipient view once, and nothing for refused, preview or revoked reads", async () => {
    const passport = await rpc<{ entries: { workId: string; version: number }[] }>("read_passport", { cursor: null });
    const entry = passport.entries.find(e => e.workId === journey.workId)!;
    item = randomUUID(); grant = randomUUID();
    await rpc("passport_share_command", { operation: "select", itemId: item, workId: journey.workId, workVersion: entry.version, summary: "Synthetic shared summary", fields });
    await rpc("passport_share_command", { operation: "prepare", grantId: grant, itemId: item, recipientId: recipient, expiresAt: new Date(Date.now() + 86400000).toISOString(), fields });
    await rpc("passport_share_command", { operation: "activate", grantId: grant });
    expect(await logRows()).toBe("0");
    await clearQuotas();
    const first = await view(recipient);
    expect(first.entries).toHaveLength(1);
    expect(await logRows()).toBe("1");
    await clearQuotas(); await view(recipient);
    expect(await logRows()).toBe("2");
    await clearQuotas();
    await expect(view(stranger)).rejects.toThrow("NOT_FOUND");
    await expect(view(worker, grant, "recipient")).rejects.toThrow("NOT_FOUND");
    await view(worker, grant, "preview");
    await expect(view(recipient, randomUUID())).rejects.toThrow("NOT_FOUND");
    expect(await logRows(), "refused, preview and unknown reads are not views").toBe("2");
  });
  it("shows the owner a summary, shows nobody else anything, and keeps the log append-only and closed to clients", async () => {
    const mine = await rpc<{ items: { grantId: string; views: number }[] }>("passport_access_summary", {});
    expect(mine.items).toMatchObject([{ grantId: grant, views: 2 }]);
    expect((await rpc<{ items: unknown[] }>("passport_access_summary", {}, recipient)).items).toEqual([]);
    expect((await rpc<{ items: unknown[] }>("passport_access_summary", {}, stranger)).items).toEqual([]);
    await expect(rpc("passport_access_summary", { grantId: grant })).rejects.toThrow("VALIDATION_FAILED");
    await expect(superuser("update private.passport_access_log set entries_shown=0")).rejects.toThrow();
    await expect(superuser("delete from private.passport_access_log")).rejects.toThrow();
    const closed = await superuser<{ a: boolean; b: boolean; c: boolean }>("select has_table_privilege('authenticated','private.passport_access_log','SELECT') a, has_function_privilege('authenticated','api.passport_projection_core(jsonb)','EXECUTE') b, has_function_privilege('anon','api.passport_projection(jsonb)','EXECUTE') c");
    expect(closed[0]).toEqual({ a: false, b: false, c: false });
  });
  it("tells the recipient about the share and the owner about the first view, hides both from others, and withdraws the recipient's after revocation", async () => {
    const feed = async (actor: string) => (await rpc<{ items: { eventKey: string; kind: string; href: string; read: boolean }[] }>("notifications", { operation: "list", cursorAt: null, cursorKey: null }, actor)).items;
    await clearQuotas();
    expect((await feed(recipient)).filter(i => i.kind === "passport_share")).toMatchObject([{ eventKey: `passport-share:${grant}`, href: "/app/passport", read: false }]);
    expect((await feed(worker)).filter(i => i.kind === "passport_view")).toMatchObject([{ eventKey: `passport-view:${grant}` }]);
    for (const actor of [stranger, rep]) expect((await feed(actor)).filter(i => i.kind.startsWith("passport_"))).toEqual([]);
    expect((await feed(worker)).filter(i => i.kind === "passport_share")).toEqual([]);
    expect(await rpc("notifications", { operation: "read", eventKey: `passport-share:${grant}` }, recipient)).toEqual({ eventKey: `passport-share:${grant}`, read: true });
    await expect(rpc("notifications", { operation: "read", eventKey: `passport-share:${grant}` }, stranger)).rejects.toThrow("NOT_FOUND");
    await rpc("passport_share_command", { operation: "revoke", grantId: grant });
    await clearQuotas();
    expect((await feed(recipient)).filter(i => i.kind === "passport_share")).toEqual([]);
    await expect(view(recipient)).rejects.toThrow("NOT_FOUND");
    expect(await logRows(), "revocation does not erase history").toBe("2");
  });
});

describe("B. Qualification records", () => {
  const id = randomUUID();
  const content = { title: "Synthetic welding certificate", issuer: "Synthetic training body", kind: "certificate", issuedOn: "2024-03", expiresOn: "2027-03", documentId: null as string | null };
  const save = (body: Record<string, unknown>, actor = worker) => rpc<{ id: string; revision: number; saved: boolean }>("qualifications", { operation: "save", idempotencyKey: randomUUID(), ...body }, actor);
  const list = (actor = worker) => rpc<{ items: { id: string; revision: number; verification: string; independentlyVerified: boolean; content: Record<string, unknown> }[] }>("qualifications", { operation: "list", cursor: null }, actor);
  const upload = async (actor = worker) => { const documentId = randomUUID(); await clearQuotas(); await rpc("vault_register", { documentId, title: "Synthetic certificate scan", category: "certificate", fileName: "cert.pdf", mediaType: "application/pdf", byteSize: 2048, sha256: "c".repeat(64), storageKey: `${actor}/${documentId}`, idempotencyKey: documentId }, actor); return documentId; };
  it("stores a self-reported record, replays a retry, versions, and never lets a client set a verification state", async () => {
    await clearQuotas();
    const key = randomUUID();
    expect(await save({ id, expectedRevision: 0, content, idempotencyKey: key })).toEqual({ id, revision: 1, saved: true });
    expect(await save({ id, expectedRevision: 0, content, idempotencyKey: key })).toEqual({ id, revision: 1, saved: true });
    await expect(save({ id, expectedRevision: 0, content: { ...content, title: "Changed" }, idempotencyKey: key })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await expect(save({ id, expectedRevision: 0, content })).rejects.toThrow("VERSION_CONFLICT");
    expect((await list()).items).toMatchObject([{ id, revision: 1, verification: "self_reported", independentlyVerified: false, content }]);
    for (const forged of [{ verification: "issuer_verified" }, { verified: true }, { independentlyVerified: true }, { status: "verified" }])
      await expect(save({ id: randomUUID(), expectedRevision: 0, content: { ...content, ...forged } }), JSON.stringify(forged)).rejects.toThrow("VALIDATION_FAILED");
    await expect(save({ id: randomUUID(), expectedRevision: 0, content, ...{ verification: "issuer_verified" } })).rejects.toThrow("VALIDATION_FAILED");
    for (const bad of [{ kind: "doctorate" }, { title: "" }, { issuedOn: "2024-13" }, { expiresOn: "2023-01" }, { documentId: "not-a-uuid" }])
      await expect(save({ id: randomUUID(), expectedRevision: 0, content: { ...content, ...bad } }), JSON.stringify(bad)).rejects.toThrow("VALIDATION_FAILED");
  });
  it("is private to its owner and append-only", async () => {
    expect((await list(stranger)).items).toEqual([]);
    expect((await list(recipient)).items).toEqual([]);
    await expect(save({ id, expectedRevision: 1, content: { ...content, title: "Hijacked" } }, stranger)).rejects.toThrow("VERSION_CONFLICT");
    expect((await list()).items[0]!.content.title).toBe(content.title);
    const closed = await superuser<{ a: boolean }>("select has_table_privilege('authenticated','private.qualification_revisions','SELECT') a");
    expect(closed[0]!.a).toBe(false);
    await expect(superuser("update private.qualification_revisions set content='{}'::jsonb")).rejects.toThrow();
    await expect(superuser("delete from private.qualification_revisions")).rejects.toThrow();
  });
  it("marks a record 'document_attached' only for the owner's own, non-revoked document, which is still not a verification", async () => {
    const mine = await upload(), theirs = await upload(stranger), revoked = await upload();
    await clearQuotas();
    expect(await save({ id, expectedRevision: 1, content: { ...content, documentId: mine } })).toMatchObject({ revision: 2 });
    expect((await list()).items).toMatchObject([{ id, revision: 2, verification: "document_attached", independentlyVerified: false }]);
    await expect(save({ id, expectedRevision: 2, content: { ...content, documentId: theirs } })).rejects.toThrow("NOT_FOUND");
    await expect(save({ id, expectedRevision: 2, content: { ...content, documentId: randomUUID() } })).rejects.toThrow("NOT_FOUND");
    await clearQuotas();
    await rpc("vault_revoke", { documentId: revoked, reason: "Superseded" });
    await expect(save({ id, expectedRevision: 2, content: { ...content, documentId: revoked } })).rejects.toThrow("EVIDENCE_REVOKED");
    await clearQuotas();
    await rpc("vault_revoke", { documentId: mine, reason: "Withdrawn" });
    expect(await save({ id, expectedRevision: 2, content: { ...content, documentId: mine, title: "Renamed after revocation" } }), "an already attached document may stay while the title changes").toMatchObject({ revision: 3 });
  });
  it("removes a record by adding a revision, keeps history, pages correctly and refuses removing an unknown record", async () => {
    await clearQuotas();
    expect(await rpc("qualifications", { operation: "remove", id, expectedRevision: 3, idempotencyKey: randomUUID() })).toMatchObject({ revision: 4, saved: true });
    expect((await list()).items).toEqual([]);
    expect((await superuser<{ n: string }>("select count(*)::text n from private.qualification_revisions where id=$1", [id]))[0]!.n).toBe("4");
    await expect(rpc("qualifications", { operation: "remove", id: randomUUID(), expectedRevision: 1, idempotencyKey: randomUUID() })).rejects.toThrow("NOT_FOUND");
    await expect(rpc("qualifications", { operation: "remove", id, expectedRevision: 3, idempotencyKey: randomUUID() })).rejects.toThrow("VERSION_CONFLICT");
    const ids: string[] = [];
    for (let i = 0; i < 22; i += 1) { await clearQuotas(); const q = randomUUID(); ids.push(q); await save({ id: q, expectedRevision: 0, content: { ...content, title: `Synthetic ${i}` } }); }
    await clearQuotas();
    const first = await rpc<{ items: { id: string }[]; nextCursor: string | null }>("qualifications", { operation: "list", cursor: null });
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    const second = await rpc<{ items: { id: string }[]; nextCursor: string | null }>("qualifications", { operation: "list", cursor: first.nextCursor });
    expect(second.items).toHaveLength(2);
    expect(new Set([...first.items, ...second.items].map(i => i.id))).toEqual(new Set(ids));
  });
});

describe("C. Realtime signals (against a stub of the Realtime schema)", () => {
  const messages = async () => superuser<{ topic: string; payload: Record<string, unknown>; event: string; private: boolean }>("select topic,payload,event,private from realtime.messages order by id");
  const topics = async (area: string) => [...new Set((await messages()).filter(m => m.payload.area === area).map(m => m.topic))].sort();
  it("signalled the two parties of the offer, and only them, with the area name and nothing else", async () => {
    const all = await messages();
    expect(await topics("offers")).toEqual([`user:${rep}`, `user:${worker}`].sort());
    for (const m of all) { expect(Object.keys(m.payload)).toEqual(["area"]); expect(m.event).toBe("changed"); expect(m.private).toBe(true); }
    const text = JSON.stringify(all);
    for (const secret of [journey.offerId, journey.workId, company, "Synthetic"]) expect(text).not.toContain(secret);
    expect(all.some(m => m.topic === `user:${stranger}` || m.topic === `user:${operator}`)).toBe(false);
  });
  it("signals only the named recipient when a share is activated or revoked", async () => {
    await clearQuotas();
    const entry = (await rpc<{ entries: { workId: string; version: number }[] }>("read_passport", { cursor: null })).entries.find(e => e.workId === journey.workId)!;
    const itemId = randomUUID(), grantId = randomUUID(), before = (await messages()).length;
    await rpc("passport_share_command", { operation: "select", itemId, workId: journey.workId, workVersion: entry.version, summary: "Signal probe", fields: ["task_summary"] });
    await rpc("passport_share_command", { operation: "prepare", grantId, itemId, recipientId: recipient, expiresAt: new Date(Date.now() + 86400000).toISOString(), fields: ["task_summary"] });
    expect((await messages()).length, "preparing a grant signals nobody").toBe(before);
    await rpc("passport_share_command", { operation: "activate", grantId });
    await rpc("passport_share_command", { operation: "revoke", grantId });
    const added = (await messages()).slice(before);
    expect(added.map(m => `${m.topic}:${m.payload.area}`).sort()).toEqual([`user:${recipient}:notifications`, `user:${recipient}:passport`, `user:${recipient}:passport`].sort());
  });
  it("signals the parties and the assigned reviewer of a case, never an outsider", async () => {
    const work = (await rpc<{ versions: { version: number; contentHash: string; evidenceHash: string; state: string }[] }>("read_work", { workId: journey.workId })).versions.at(-1)!;
    const before = (await messages()).length;
    await clearQuotas();
    await rpc("work_case_command", { operation: "open", caseId: randomUUID(), idempotencyKey: randomUUID(), workId: journey.workId, expectedVersion: work.version, expectedHash: work.contentHash, expectedEvidenceHash: work.evidenceHash, expectedState: work.state, reasonCode: "incorrect_pay", reason: "Synthetic signal probe" });
    const added = (await messages()).slice(before);
    expect([...new Set(added.map(m => m.topic))].sort()).toEqual([`user:${rep}`, `user:${worker}`].sort());
    expect(added.every(m => ["cases", "notifications"].includes(String(m.payload.area)))).toBe(true);
  });
  it("lets an account receive only its own topic, never publish, and never breaks the business write if Realtime fails", async () => {
    // Authorization to subscribe, modelled the way the Realtime service asks the question: with the topic being joined set, can this account read any broadcast at all?
    const canJoin = async (actor: string | null, topic: string) => {
      await db.exec("begin; set local role authenticated");
      try {
        await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(actor ? { sub: actor, role: "authenticated" } : { role: "authenticated" })]);
        await db.query("select set_config('realtime.topic',$1,true)", [topic]);
        const allowed = (await db.query<{ ok: boolean }>("select exists(select 1 from realtime.messages) ok")).rows[0]!.ok;
        await db.exec("commit");
        return allowed;
      } catch (error) { await db.exec("rollback"); throw error; }
    };
    expect(await canJoin(worker, `user:${worker}`)).toBe(true);
    expect(await canJoin(stranger, `user:${worker}`), "someone else's topic").toBe(false);
    expect(await canJoin(worker, `user:${stranger}`), "own identity, another account's topic").toBe(false);
    expect(await canJoin(worker, "user:*"), "a wildcard topic").toBe(false);
    expect(await canJoin(worker, ""), "no topic").toBe(false);
    expect(await canJoin(null, `user:${worker}`), "no identity").toBe(false);
    await db.exec("reset role");
    await expect(db.exec("set role authenticated; insert into realtime.messages(topic,payload) values('user:x','{}'::jsonb)")).rejects.toThrow();
    await db.exec("reset role");
    await db.exec("alter function realtime.send(jsonb,text,text,boolean) rename to send_ok;create function realtime.send(payload jsonb,event text,topic text,private boolean default true) returns void language plpgsql security definer as $$begin raise exception 'realtime down';end $$");
    try {
      const offer = randomUUID();
      await rpc("review_offer", { offerId: offer, companyId: company, workerId: worker, requesterRole: "EMPLOYER", terms: { role: "Signal outage probe", salary: 100, currency: "LKR", hoursPerWeek: 40, responsibilities: "Synthetic work", startDate: "2026-11-01" }, expectedVersion: 1, idempotencyKey: randomUUID() }, rep);
      expect((await superuser<{ n: string }>("select count(*)::text n from private.day3_offers where offer_id=$1", [offer]))[0]!.n).toBe("1");
    } finally {
      await db.exec("reset role");
      await db.exec("drop function realtime.send(jsonb,text,text,boolean);alter function realtime.send_ok(jsonb,text,text,boolean) rename to send");
    }
  });
});
