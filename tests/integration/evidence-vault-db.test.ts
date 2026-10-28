import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { localPostgresConnection } from "../local-postgres";

const realPostgres=Boolean(process.env.FAIRWORK_LOCAL_POSTGRES_PORT);
const db = realPostgres ? await localPostgresConnection() : new PGlite();
afterAll(() => db.close());
const WORKER = "40000000-0000-4000-8000-000000000012";
const APPROVER = "40000000-0000-4000-8000-000000000013";
const MEMBER = "40000000-0000-4000-8000-000000000014";
const OTHER = "40000000-0000-4000-8000-000000000015";
let COMPANY: string;

function claims(id: string, aal = "aal2") {
  return { sub: id, role: "authenticated", aal, is_anonymous: false };
}

async function run<T = Record<string, unknown>>(sql: string, params: unknown[] = [], jwt:Record<string,unknown> = claims(APPROVER), role = "authenticated") {
  await db.exec(`begin; set local role ${role}`);
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(jwt)]);
    const result = await db.query<T>(sql, params);
    await db.exec("commit");
    return result.rows;
  } catch (error) {
    await db.exec("rollback");
    throw error;
  }
}

async function runMigration(sql: string) {
  const statements: string[] = [];
  let start = 0;
  let quote: "'" | '"' | null = null;
  let dollarTag: string | null = null;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < sql.length; index += 1) {
    if (lineComment) {
      if (sql[index] === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (sql.startsWith("*/", index)) {
        index += 1;
        blockComment = false;
      }
      continue;
    }
    if (dollarTag) {
      if (sql.startsWith(dollarTag, index)) {
        index += dollarTag.length - 1;
        dollarTag = null;
      }
      continue;
    }
    const char = sql[index]!;
    if (quote) {
      if (char === quote && sql[index + 1] === quote) {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (sql.startsWith("--", index)) {
      lineComment = true;
      index += 1;
      continue;
    }
    if (sql.startsWith("/*", index)) {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "$") {
      const tag = sql.slice(index).match(/^\$[A-Za-z_][A-Za-z_0-9]*\$|^\$\$/)?.[0];
      if (tag) {
        dollarTag = tag;
        index += tag.length - 1;
        continue;
      }
    }
    if (char === ";") {
      const statement = sql.slice(start, index + 1).trim();
      if (statement) statements.push(statement);
      start = index + 1;
    }
  }
  const trailing = sql.slice(start).trim();
  if (trailing) statements.push(trailing);
  for (const [index, statement] of statements.entries()) {
    try {
      await db.exec(statement);
    } catch (error) {
      throw new Error(`Day 3 migration statement ${index + 1} failed: ${statement.slice(0, 180)}`, { cause: error });
    }
  }
}

beforeAll(async () => {
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;`);
  await db.exec(`create schema auth; create table auth.users(id uuid primary key);`);
  await db.exec(`create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;`);
  await db.exec(`create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;`);
  await db.exec(`grant usage on schema auth to anon, authenticated, service_role;`);

  await db.exec(await readFile("supabase/migrations/202610070001_identity_foundation.sql", "utf8"));
  await db.exec("revoke usage on schema auth from fw_user_exec, fw_policy_exec");
  await db.exec(await readFile("supabase/migrations/202610080002_identity_auth_context.sql", "utf8"));
  await db.exec(await readFile("supabase/migrations/202610090001_identity_rpc_execute.sql", "utf8"));
  for (const id of [WORKER, APPROVER, MEMBER, OTHER]) {
    await db.exec(`insert into auth.users values('${id}')`);
    await run("select api.create_profile($1::jsonb)", [
      JSON.stringify({ displayName: `Synthetic ${id}`, locale: "en", timeZone: "UTC", idempotencyKey: crypto.randomUUID() }),
    ], claims(id));
  }
  await db.exec(`create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key);
    insert into supabase_migrations.schema_migrations values ('202610070001'),('202610080002'),('202610090001');
    insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at)
    values('${APPROVER}','authority_operator','${MEMBER}','Local synthetic Day 3 fixture',now()+interval '1 day'),
          ('${MEMBER}','authority_operator','${APPROVER}','Local synthetic Day 3 fixture',now()+interval '1 day');
    revoke usage on schema auth from fw_user_exec,fw_policy_exec;
    create role fixture_root superuser;
    create role managed_auth_owner nologin;
    alter schema auth owner to managed_auth_owner;
    grant usage on schema auth to postgres;
    set session authorization fixture_root;
    alter role postgres rename to fixture_bootstrap;
    create role postgres login inherit nosuperuser nobypassrls createrole;
    grant fw_schema_owner,fw_user_exec,fw_policy_exec to postgres;
    grant usage on schema auth to postgres;
    grant usage, create on schema private to postgres;
    alter function private.request_uid() owner to postgres;
    alter function private.request_jwt() owner to postgres;
    grant create on schema private to postgres;
    grant usage on schema supabase_migrations to postgres;
    grant select on supabase_migrations.schema_migrations to postgres;
    set role postgres;`);
  try {
    await db.exec(await readFile("supabase/migrations/202610090002_demo_authority.sql", "utf8"));
  } finally {
    await db.exec("reset role");
  }
  await db.exec("insert into supabase_migrations.schema_migrations values('202610090002')");

  const provision = await run(`select api.provision_company($1::jsonb) as value`, [
    JSON.stringify({ name: "Synthetic Day 3 company", idempotencyKey: crypto.randomUUID() }),
  ], claims(MEMBER));
  COMPANY = String((provision[0] as { value: { id: string } }).value.id);
  const approve = async (subjectId: string, actorId: string) => run(`select api.decide_membership($1::jsonb) as value`, [
    JSON.stringify({
      companyId: COMPANY,
      subjectId,
      decision: "approve",
      expectedRevision: 0,
      expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
      reviewedEvidenceRefs: ["demo:fixture/representative"],
      reason: "Synthetic Day 3 test authority",
      policyVersion: "demo-authority.v1",
      idempotencyKey: crypto.randomUUID(),
    }),
  ], claims(actorId));
  await approve(APPROVER, MEMBER);
  await approve(WORKER, APPROVER);
  await approve(MEMBER, APPROVER);
  await bootstrapAudit();

  await db.exec("set role postgres");
  const preflight = await db.exec(await readFile("scripts/day3-hosted-preflight.sql", "utf8"));
  const preflightResults = preflight.find((result) => result.command === "SELECT");
  expect(preflightResults?.rows).toHaveLength(10);
  expect(preflightResults?.rows.map((row) => row.result)).toEqual(Array(10).fill("PASS"));
  const migrationPrivileges = await db.query<{ role: string; schemaUsage: boolean; schemaCreate: boolean }>(
    "select current_user as role, has_schema_privilege(current_user, 'private', 'USAGE') as schemaUsage, has_schema_privilege(current_user, 'private', 'CREATE') as schemaCreate",
  );
  expect(migrationPrivileges.rows).toEqual([{ role: "postgres", schemausage: true, schemacreate: true }]);
  try {
    await runMigration(await readFile("supabase/migrations/202610100001_day3_offer_agreement.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/202610120001_agreement_participant_read.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/202610140001_versioned_agreements.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/202610140002_work_records.sql", "utf8"));
    if(existsSync("supabase/migrations/202610140003_work_integrity_passport.sql")) await runMigration(await readFile("supabase/migrations/202610140003_work_integrity_passport.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/202610150001_work_case_review.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/20261027100000_evidence_vault.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/20261028160000_vault_attachments.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/20261028190000_offer_notes.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/20261029110000_research_history.sql", "utf8"));
  } catch (error) {
    await db.exec("rollback").catch(() => undefined);
    throw error;
  } finally {
    await db.exec("reset role");
  }
  await db.exec("revoke create on schema private from postgres");
  await db.exec("insert into supabase_migrations.schema_migrations values('202610100001')");
  await db.exec("insert into supabase_migrations.schema_migrations values('202610120001')");
});


async function clearQuotas() { await db.exec("delete from private.rate_limit_buckets"); }
async function bootstrapAudit() {
  await db.query("insert into private.audit_logs(actor_id,action,target_id,request_id,changed_field_names,reason_code,retention_class) values($1,'bootstrap_capability',$1,$2,array['capability'],'offline_capability_bootstrap','authority')", [APPROVER, crypto.randomUUID()]);
}

const SHA = "a".repeat(64);
const doc = (over: Record<string, unknown> = {}, owner = WORKER) => {
  const id = crypto.randomUUID();
  return { documentId: id, title: "Synthetic welding certificate", category: "certificate", fileName: "certificate.pdf", mediaType: "application/pdf", byteSize: 2048, sha256: SHA, storageKey: `${owner}/${id}`, idempotencyKey: id, ...over };
};
const rpc = async (name: string, request: unknown, actor: string | null = WORKER) => (await run<{ value: Record<string, unknown> }>(`select api.${name}($1::jsonb) value`, [request], actor ? claims(actor) : {}, actor ? "authenticated" : "anon"))[0]!.value;

describe("evidence vault metadata", () => {
  it("registers, lists, fetches and deletes the owner's document, leaving only an audit event", async () => {
    await clearQuotas();
    const request = doc();
    expect(await rpc("vault_register", request)).toEqual({ documentId: request.documentId, replayed: false });
    const listed = await rpc("vault_list", {});
    expect(listed).toMatchObject({ limit: 50, used: 1 });
    expect((listed.items as Record<string, unknown>[])[0]).toMatchObject({ documentId: request.documentId, title: request.title, mediaType: "application/pdf", byteSize: 2048, sha256: SHA });
    expect(await rpc("vault_fetch", { documentId: request.documentId })).toEqual({ documentId: request.documentId, storageKey: request.storageKey, fileName: "certificate.pdf", mediaType: "application/pdf" });
    expect(await rpc("vault_delete", { documentId: request.documentId })).toEqual({ documentId: request.documentId, storageKey: request.storageKey });
    expect((await rpc("vault_list", {})).items).toEqual([]);
    await expect(rpc("vault_fetch", { documentId: request.documentId })).rejects.toThrow("NOT_FOUND");
    const events = await run<{ event: string; sha256: string }>("select event,sha256 from private.vault_events where document_id=$1 order by at,event", [request.documentId], claims(WORKER), "fw_user_exec");
    expect(events.map(row => row.event).sort()).toEqual(["deleted", "uploaded"]);
    expect(await run("select title from private.vault_documents where id=$1", [request.documentId], claims(WORKER), "fw_user_exec")).toEqual([]);
  });

  it("keeps documents private: others cannot list, fetch, delete or learn that one exists", async () => {
    await clearQuotas();
    const request = doc(); await rpc("vault_register", request);
    expect((await rpc("vault_list", {}, OTHER)).items).toEqual([]);
    await expect(rpc("vault_fetch", { documentId: request.documentId }, OTHER)).rejects.toThrow("NOT_FOUND");
    await expect(rpc("vault_delete", { documentId: request.documentId }, OTHER)).rejects.toThrow("NOT_FOUND");
    await expect(rpc("vault_fetch", { documentId: request.documentId }, APPROVER)).rejects.toThrow("NOT_FOUND"); // not even an operator
    expect(await run("select id from private.vault_documents where id=$1", [request.documentId], claims(OTHER), "fw_user_exec")).toEqual([]);
    expect(await run("select id from private.vault_documents where id=$1", [request.documentId], claims(WORKER), "fw_user_exec")).toHaveLength(1);
    expect(await rpc("vault_list", {})).toMatchObject({ used: expect.any(Number) });
    await rpc("vault_delete", { documentId: request.documentId });
  });

  it("is idempotent, rejects a conflicting reuse, and refuses a storage key that is not the caller's", async () => {
    await clearQuotas();
    const request = doc();
    const first = await rpc("vault_register", request);
    expect(await rpc("vault_register", request)).toEqual({ documentId: first.documentId, replayed: true });
    await expect(rpc("vault_register", { ...request, sha256: "b".repeat(64) })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    const stolen = doc({}, OTHER);
    await expect(rpc("vault_register", { ...stolen, idempotencyKey: crypto.randomUUID() })).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("vault_register", doc({ storageKey: `${WORKER}/../${OTHER}/x` }))).rejects.toThrow("VALIDATION_FAILED");
    await rpc("vault_delete", { documentId: request.documentId });
  });

  it("rejects malformed metadata, unsafe names, bad types and oversize files", async () => {
    await clearQuotas();
    for (const bad of [{ fileName: "../x.pdf" }, { fileName: "a<b>.pdf" }, { fileName: "" }, { mediaType: "text/html" }, { mediaType: "application/x-msdownload" }, { category: "secret" }, { title: "   " }, { sha256: "xyz" }, { byteSize: 0 }, { byteSize: 5242881 }, { byteSize: "10" }])
      await expect(rpc("vault_register", doc(bad)), JSON.stringify(bad)).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("vault_register", { ...doc(), extra: "x" })).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("vault_list", { extra: 1 })).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("vault_delete", { documentId: "not-a-uuid" })).rejects.toThrow("VALIDATION_FAILED");
  });

  it("enforces the fifty-document limit per owner and frees room on deletion", async () => {
    await clearQuotas();
    const ids: string[] = [];
    for (let i = 0; i < 50; i += 1) { if (i % 10 === 0) await clearQuotas(); const request = doc(); ids.push(request.documentId); await rpc("vault_register", request); }
    await clearQuotas();
    await expect(rpc("vault_register", doc())).rejects.toThrow("RATE_LIMITED");
    await rpc("vault_delete", { documentId: ids[0] });
    await rpc("vault_register", doc());
    for (const id of ids.slice(1)) { if (ids.indexOf(id) % 10 === 0) await clearQuotas(); await rpc("vault_delete", { documentId: id }); }
    await clearQuotas();
    for (const [index, row] of ((await rpc("vault_list", {})).items as { documentId: string }[]).entries()) { if (index % 10 === 0) await clearQuotas(); await rpc("vault_delete", { documentId: row.documentId }); }
  });

  it("is closed to anonymous callers and its audit trail cannot be rewritten", async () => {
    await clearQuotas();
    await expect(rpc("vault_list", {}, null)).rejects.toThrow();
    await expect(rpc("vault_register", doc(), null)).rejects.toThrow();
    const request = doc(); await rpc("vault_register", request);
    await expect(run("update private.vault_events set byte_size=1 where document_id=$1", [request.documentId], claims(WORKER), "fw_user_exec")).rejects.toThrow();
    await expect(run("delete from private.vault_events where document_id=$1", [request.documentId], claims(WORKER), "fw_user_exec")).rejects.toThrow();
    await expect(run("insert into private.vault_documents(id,owner_id,title,category,file_name,media_type,byte_size,sha256,storage_key,idempotency_key) values($1,$2,'x','other','x.pdf','application/pdf',1,$3,$4,gen_random_uuid())", [crypto.randomUUID(), OTHER, SHA, `${OTHER}/x`], claims(WORKER), "fw_user_exec")).rejects.toThrow();
    await rpc("vault_delete", { documentId: request.documentId });
  });
});

describe("evidence vault attachments to work records", () => {
  const WORK = crypto.randomUUID(), THEIRS = crypto.randomUUID();
  // The agreement chain behind a work record is covered by its own tests; foreign keys are bypassed here only to place two rows.
  beforeAll(async () => {
    await db.exec("reset role");
    await db.exec("set session_replication_role = replica");
    for (const [id, worker] of [[WORK, WORKER], [THEIRS, OTHER]] as const) {
      await db.query("insert into private.work_records(id,agreement_id,worker_id,company_id,representative_id,current_version) values($1,$2,$3,$4,$5,1)", [id, crypto.randomUUID(), worker, COMPANY, APPROVER]);
    }
    await db.exec("set session_replication_role = origin");
  });
  const upload = async (owner = WORKER) => { const request = doc({}, owner); await rpc("vault_register", request, owner); return request.documentId as string; };

  it("lets the worker attach and detach their own document, idempotently, and lists only their links", async () => {
    await clearQuotas();
    const id = await upload();
    expect(await rpc("vault_attach", { documentId: id, workId: WORK })).toEqual({ documentId: id, workId: WORK, replayed: false });
    expect(await rpc("vault_attach", { documentId: id, workId: WORK })).toMatchObject({ replayed: true });
    const listed = await rpc("vault_attachments", { workId: WORK });
    expect((listed.items as Record<string, unknown>[]).map(item => item.documentId)).toEqual([id]);
    expect(await rpc("vault_attachments", { workId: WORK }, OTHER)).toMatchObject({ items: [] });
    expect(await rpc("vault_detach", { documentId: id, workId: WORK })).toEqual({ documentId: id, workId: WORK });
    await expect(rpc("vault_detach", { documentId: id, workId: WORK })).rejects.toThrow("NOT_FOUND");
    await rpc("vault_delete", { documentId: id });
  });

  it("refuses someone else's document or record with the same answer as a missing one", async () => {
    await clearQuotas();
    const mine = await upload(), theirs = await upload(OTHER);
    await expect(rpc("vault_attach", { documentId: theirs, workId: WORK })).rejects.toThrow("NOT_FOUND");
    await expect(rpc("vault_attach", { documentId: mine, workId: THEIRS })).rejects.toThrow("NOT_FOUND");
    await expect(rpc("vault_attach", { documentId: mine, workId: crypto.randomUUID() })).rejects.toThrow("NOT_FOUND");
    await expect(rpc("vault_attach", { documentId: mine, workId: WORK, extra: 1 })).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("vault_attach", { documentId: mine, workId: WORK }, null)).rejects.toThrow();
    await rpc("vault_delete", { documentId: mine }); await rpc("vault_delete", { documentId: theirs }, OTHER);
  });

  it("removes links when the document is deleted and caps links per record at ten", async () => {
    await clearQuotas();
    const first = await upload();
    await rpc("vault_attach", { documentId: first, workId: WORK });
    await rpc("vault_delete", { documentId: first });
    expect((await rpc("vault_attachments", { workId: WORK })).items).toEqual([]);
    const ids: string[] = [];
    for (let index = 0; index < 11; index += 1) { await clearQuotas(); ids.push(await upload()); }
    for (const id of ids.slice(0, 10)) { await clearQuotas(); await rpc("vault_attach", { documentId: id, workId: WORK }); }
    await clearQuotas();
    await expect(rpc("vault_attach", { documentId: ids[10]!, workId: WORK })).rejects.toThrow("RATE_LIMITED");
    for (const id of ids) { await clearQuotas(); await rpc("vault_delete", { documentId: id }); }
  });
});

describe("private offer notes and supporting documents", () => {
  const OFFER = crypto.randomUUID(), THEIRS = crypto.randomUUID();
  beforeAll(async () => {
    await db.exec("reset role");
    await db.exec("set session_replication_role = replica");
    for (const [offer, worker] of [[OFFER, WORKER], [THEIRS, OTHER]] as const) {
      await db.query("insert into private.day3_offers(id,offer_id,company_id,worker_id,representative_id,requester_id,requester_role,version,term_hash,snapshot,created_by) values($1,$2,$3,$4,$5,$4,'WORKER',1,$6,'{}'::jsonb,$4)", [crypto.randomUUID(), offer, COMPANY, worker, APPROVER, SHA]);
    }
    await db.exec("set session_replication_role = origin");
  });
  const upload = async (owner = WORKER) => { const request = doc({}, owner); await rpc("vault_register", request, owner); return request.documentId as string; };
  const note = (over: Record<string, unknown> = {}) => ({ noteId: crypto.randomUUID(), offerId: OFFER, body: "Ask about the overtime rate", idempotencyKey: crypto.randomUUID(), ...over });

  it("adds, lists newest first, replays and deletes the worker's own notes", async () => {
    await clearQuotas();
    const first = note(); expect(await rpc("offer_note_add", first)).toEqual({ noteId: first.noteId, replayed: false });
    expect(await rpc("offer_note_add", first)).toMatchObject({ replayed: true });
    await expect(rpc("offer_note_add", { ...first, body: "Changed" })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    const second = note({ body: "Confirm probation length" }); await rpc("offer_note_add", second);
    const listed = (await rpc("offer_note_list", { offerId: OFFER })).items as Record<string, unknown>[];
    expect(listed.map(item => item.noteId)).toEqual([second.noteId, first.noteId]);
    expect(await rpc("offer_note_list", { offerId: OFFER }, OTHER)).toMatchObject({ items: [] });
    await rpc("offer_note_delete", { noteId: first.noteId });
    await expect(rpc("offer_note_delete", { noteId: first.noteId })).rejects.toThrow("NOT_FOUND");
    await expect(rpc("offer_note_delete", { noteId: second.noteId }, OTHER)).rejects.toThrow("NOT_FOUND");
    await rpc("offer_note_delete", { noteId: second.noteId });
  });

  it("refuses notes on someone else's offer, bad bodies, extra fields and signed-out callers", async () => {
    await clearQuotas();
    await expect(rpc("offer_note_add", note({ offerId: THEIRS }))).rejects.toThrow("NOT_FOUND");
    await expect(rpc("offer_note_add", note({ offerId: crypto.randomUUID() }))).rejects.toThrow("NOT_FOUND");
    await expect(rpc("offer_note_add", note({ body: "   " }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("offer_note_add", note({ body: "x".repeat(1001) }))).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("offer_note_add", { ...note(), extra: 1 })).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("offer_note_add", note(), null)).rejects.toThrow();
    await expect(run("select * from private.offer_notes", [], claims(WORKER), "authenticated")).rejects.toThrow();
  });

  it("attaches and detaches the worker's own documents to their own offer, listing only theirs", async () => {
    await clearQuotas();
    const id = await upload();
    expect(await rpc("vault_attach_offer", { documentId: id, offerId: OFFER })).toEqual({ documentId: id, offerId: OFFER, replayed: false });
    expect(await rpc("vault_attach_offer", { documentId: id, offerId: OFFER })).toMatchObject({ replayed: true });
    expect(((await rpc("vault_offer_attachments", { offerId: OFFER })).items as Record<string, unknown>[]).map(item => item.documentId)).toEqual([id]);
    expect(await rpc("vault_offer_attachments", { offerId: OFFER }, OTHER)).toMatchObject({ items: [] });
    await rpc("vault_detach_offer", { documentId: id, offerId: OFFER });
    await expect(rpc("vault_detach_offer", { documentId: id, offerId: OFFER })).rejects.toThrow("NOT_FOUND");
    await rpc("vault_delete", { documentId: id });
  });

  it("refuses foreign documents or offers, and removes links with the document", async () => {
    await clearQuotas();
    const mine = await upload(), theirs = await upload(OTHER);
    await expect(rpc("vault_attach_offer", { documentId: theirs, offerId: OFFER })).rejects.toThrow("NOT_FOUND");
    await expect(rpc("vault_attach_offer", { documentId: mine, offerId: THEIRS })).rejects.toThrow("NOT_FOUND");
    await expect(rpc("vault_attach_offer", { documentId: mine, offerId: OFFER, extra: 1 })).rejects.toThrow("VALIDATION_FAILED");
    await rpc("vault_attach_offer", { documentId: mine, offerId: OFFER });
    await rpc("vault_delete", { documentId: mine });
    expect((await rpc("vault_offer_attachments", { offerId: OFFER })).items).toEqual([]);
    await rpc("vault_delete", { documentId: theirs }, OTHER);
  });
});

describe("private company research history", () => {
  const entry = (over: Record<string, unknown> = {}) => { const id = crypto.randomUUID(); return { entryId: id, queryName: "Synthetic Garage Ltd", queryCountry: "DE", totalMatches: 3, topLei: "5493001KJTIIGC8Y1R12", topName: "SYNTHETIC GARAGE LTD", topMatch: "exact", source: "GLEIF", retrievedAt: "2026-10-28T10:00:00Z", idempotencyKey: id, ...over }; };
  it("saves, lists newest first, replays and deletes only the owner's entries", async () => {
    await clearQuotas();
    const first = entry(), second = entry({ queryName: "Another Synthetic Co", queryCountry: null, topLei: null, topName: null, topMatch: "none", totalMatches: 0 });
    expect(await rpc("research_history_add", first)).toEqual({ entryId: first.entryId, replayed: false });
    expect(await rpc("research_history_add", first)).toEqual({ entryId: first.entryId, replayed: true });
    await rpc("research_history_add", second);
    const listed = (await rpc("research_history_list", {})).items as Record<string, unknown>[];
    expect(listed.map(item => item.queryName)).toEqual(["Another Synthetic Co", "Synthetic Garage Ltd"]);
    expect(listed[1]).toMatchObject({ topLei: "5493001KJTIIGC8Y1R12", topMatch: "exact", source: "GLEIF", totalMatches: 3 });
    expect(((await rpc("research_history_list", {}, OTHER)).items as unknown[])).toEqual([]);
    await expect(rpc("research_history_delete", { entryId: first.entryId }, OTHER)).rejects.toThrow("NOT_FOUND");
    await rpc("research_history_delete", { entryId: first.entryId });
    await rpc("research_history_delete", { entryId: second.entryId });
    await expect(rpc("research_history_delete", { entryId: first.entryId })).rejects.toThrow("NOT_FOUND");
  });
  it("refuses a reused key with a different entry, bad shapes and signed-out callers", async () => {
    await clearQuotas();
    const base = entry(); await rpc("research_history_add", base);
    await expect(rpc("research_history_add", entry({ idempotencyKey: base.idempotencyKey }))).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    for (const bad of [{ queryName: "" }, { queryName: "x".repeat(201) }, { queryCountry: "de" }, { topLei: "short" }, { topMatch: "perfect" }, { totalMatches: -1 }, { totalMatches: 1.5 }, { retrievedAt: "not a time" }, { extra: 1 }])
      await expect(rpc("research_history_add", entry(bad)), JSON.stringify(bad)).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("research_history_list", { extra: 1 })).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("research_history_list", {}, null)).rejects.toThrow();
    await rpc("research_history_delete", { entryId: base.entryId });
  });
  it("keeps only the newest fifty entries per person", async () => {
    await clearQuotas();
    for (let i = 0; i < 52; i += 1) { if (i % 20 === 0) await clearQuotas(); await rpc("research_history_add", entry({ queryName: `Synthetic ${i}` })); }
    const items = (await rpc("research_history_list", {})).items as Record<string, unknown>[];
    expect(items).toHaveLength(50); expect(items[0]!.queryName).toBe("Synthetic 51"); expect(items.at(-1)!.queryName).toBe("Synthetic 2");
    for (const item of items) { if (items.indexOf(item) % 20 === 0) await clearQuotas(); await rpc("research_history_delete", { entryId: item.entryId }); }
  });
});
