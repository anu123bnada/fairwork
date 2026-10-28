import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import { localPostgresConnection } from "../local-postgres";

// Pre-flight rehearsal for migration 20261029170000 (audit chain time-zone pin). The schema is built exactly as staging was: every migration up to the chain
// migration, then (optionally) the audit rows of a restored staging logical backup (FAIRWORK_BACKUP_DIR), then the chain migration, which backfills the chain in a UTC
// session. Only then is the pin applied. The test proves that no chain link, no audit row and no head hash changes, that verification becomes independent of the
// session time zone, that grants and function security are untouched, that the migration can be rolled back, and that the pre-flight query (verify from a UTC
// session before applying) predicts the result after applying.
const PIN = "20261029170000_audit_chain_timezone_pin.sql";
const CHAIN = "20261029160000_audit_chain.sql";
const ZONES = ["UTC", "Asia/Colombo", "America/Los_Angeles", "Asia/Kolkata", "Pacific/Kiritimati", "Pacific/Pago_Pago", "Europe/Berlin"];
const real = Boolean(process.env.FAIRWORK_LOCAL_POSTGRES_PORT);
const db = real ? await localPostgresConnection() : new PGlite();
afterAll(() => db.close());
const owner = randomUUID();

type Verdict = { checked: number; ok: boolean; brokenLinks: number; alteredOrDeletedRecords: number; recordsNotInChain: number; head: string | null };
async function verifyIn(zone: string): Promise<Verdict> {
  await db.exec("reset role");
  await db.exec(`set time zone '${zone}'`);
  try { return (await db.query<{ v: Verdict }>("select private.audit_chain_verify() v")).rows[0]!.v; } finally { await db.exec("set time zone 'UTC'"); }
}
async function writeIn(zone: string, text: string) {
  await db.exec("reset role");
  await db.exec(`set time zone '${zone}'`);
  try { await db.query("insert into private.admin_audit(id,actor_id,action,target_id,revision,reason,changes) values($1,$2,'settings',$2,1,$3,'{}'::jsonb)", [randomUUID(), owner, text]); } finally { await db.exec("set time zone 'UTC'"); }
}
const digest = async (table: string) => (await db.query<{ h: string; n: string }>(`select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(t)::text,'|' order by to_jsonb(t)::text),''),'UTF8')),'hex') h, count(*)::text n from ${table} t`)).rows[0]!;
const snapshot = async () => ({ chain: await digest("private.audit_chain"), logs: await digest("private.audit_logs"), admin: await digest("private.admin_audit") });
const meta = async () => (await db.query<Record<string, unknown>>(`select p.oid::regprocedure::text fn, pg_get_userbyid(p.proowner) owner, p.prosecdef secdef, coalesce(p.proacl::text,'') acl,
  coalesce((select string_agg(c,',' order by c) from unnest(p.proconfig) c where lower(c) not like 'timezone=%'),'') other_config, coalesce((select string_agg(c,',') from unnest(p.proconfig) c where lower(c) like 'timezone=%'),'') tz
  from pg_proc p where p.pronamespace='private'::regnamespace and p.proname in ('audit_chain_append','audit_chain_verify','audit_chain_hash') or (p.pronamespace='api'::regnamespace and p.proname='audit_chain_verify') order by 1`)).rows;

let backupRows = 0;
let before: Awaited<ReturnType<typeof snapshot>>;
let metaBefore: Record<string, unknown>[];

beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;");
  await db.exec("set time zone 'UTC'");
  const files = (await readdir("supabase/migrations")).sort().filter(file => file !== PIN);
  const at = files.indexOf(CHAIN);
  for (const file of files.slice(0, at)) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  await db.query("insert into auth.users values($1)", [owner]);
  await db.query("insert into private.profiles(id,display_name) values($1,'Owner')", [owner]);
  const dir = process.env.FAIRWORK_BACKUP_DIR;
  if (dir && existsSync(`${dir}/data.json`)) {
    const tables = JSON.parse(readFileSync(`${dir}/data.json`, "utf8")).tables as Record<string, unknown[]>;
    await db.exec("set session_replication_role = replica");
    for (const name of ["private.audit_logs", "private.admin_audit"]) {
      const rows = tables[name] ?? [];
      if (rows.length) await db.query(`insert into ${name} select * from jsonb_populate_recordset(null::${name}, $1::jsonb)`, [JSON.stringify(rows)]);
      backupRows += rows.length;
    }
    await db.exec("set session_replication_role = origin");
  }
  // History that predates the chain, written from sessions in other zones, as a long-lived deployment would have.
  for (const zone of ["Asia/Colombo", "America/Los_Angeles", "UTC"]) await writeIn(zone, `Synthetic history written from ${zone}`);
  await db.exec(await readFile(`supabase/migrations/${CHAIN}`, "utf8"));
  for (const file of files.slice(at + 1)) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  for (let i = 0; i < 5; i += 1) await writeIn("UTC", `Synthetic hosted write ${i}`);
  before = await snapshot();
  metaBefore = await meta();
}, 240000);

describe("audit chain time-zone pin (migration 27) on a rebuilt staging state", () => {
  it("starts from a valid chain that covers the restored audit rows", async () => {
    if (process.env.FAIRWORK_BACKUP_DIR) expect(backupRows).toBeGreaterThan(0);
    const v = await verifyIn("UTC");
    expect(v).toMatchObject({ ok: true, brokenLinks: 0, alteredOrDeletedRecords: 0, recordsNotInChain: 0 });
    expect(v.checked).toBe(Number(before.logs.n) + Number(before.admin.n));
    expect(metaBefore.every(row => row.tz === ""), "no time-zone setting before the pin").toBe(true);
  });

  it("before the pin, the same unchanged chain fails from other zones (the defect on real rows)", async () => {
    const colombo = await verifyIn("Asia/Colombo");
    const la = await verifyIn("America/Los_Angeles");
    // Only the pre-existing UTC-chained rows are affected by the caller's zone; the Colombo and Los Angeles history rows were chained by the backfill in UTC.
    expect(colombo.ok || la.ok, "if verification already passes from every zone, the pin has nothing to fix").toBe(false);
  });

  it("applies without rewriting, deleting or rehashing anything", async () => {
    const utcBefore = await verifyIn("UTC");
    await db.exec(await readFile(`supabase/migrations/${PIN}`, "utf8"));
    const after = await snapshot();
    expect(after).toEqual(before);
    const utcAfter = await verifyIn("UTC");
    expect(utcAfter).toEqual(utcBefore);
    expect(utcAfter.head).toBe(utcBefore.head);
  });

  it("makes verification identical from every session time zone", async () => {
    const results: (readonly [string, Verdict])[] = [];
    for (const zone of ZONES) results.push([zone, await verifyIn(zone)] as const);
    for (const [zone, v] of results) expect({ zone, ok: v.ok, bad: v.alteredOrDeletedRecords, links: v.brokenLinks }).toEqual({ zone, ok: true, bad: 0, links: 0 });
    expect(new Set(results.map(([, v]) => v.head)).size).toBe(1);
  });

  it("changes only the time-zone setting of the two hashing functions: owner, security, grants and other settings are untouched", async () => {
    const after = await meta();
    expect(after).toHaveLength(metaBefore.length);
    for (const row of after) {
      const old = metaBefore.find(x => x.fn === row.fn)!;
      expect({ ...row, tz: undefined }).toEqual({ ...old, tz: undefined });
      expect(row.other_config, row.fn as string).toContain("search_path");
      if (!(row.fn as string).startsWith("private.audit_chain_hash")) expect(row.secdef, row.fn as string).toBe(true);
      if ((row.fn as string).startsWith("private.audit_chain_append") || (row.fn as string).startsWith("private.audit_chain_verify")) expect(row.tz).toBe("TimeZone=UTC");
      else expect(row.tz).toBe("");
    }
    const grants = await db.query<{ a: boolean; b: boolean; c: boolean }>("select has_table_privilege('authenticated','private.audit_chain','SELECT') a, has_function_privilege('authenticated','private.audit_chain_verify()','EXECUTE') b, has_function_privilege('anon','api.audit_chain_verify(jsonb)','EXECUTE') c");
    expect(grants.rows[0]).toEqual({ a: false, b: false, c: false });
  });

  it("chains new rows written from any zone to the same link a UTC session would have produced", async () => {
    const start = (await verifyIn("UTC")).checked;
    for (const zone of ZONES) await writeIn(zone, `Written after the pin from ${zone}`);
    for (const zone of ZONES) expect((await verifyIn(zone)).ok, zone).toBe(true);
    expect((await verifyIn("UTC")).checked).toBe(start + ZONES.length);
  });

  it("can be altered by a member of the function owner role (the hosted migration identity) and by nobody else", async () => {
    await db.exec("reset role");
    await db.exec("create role qa_migrator login nosuperuser inherit;create role qa_outsider login nosuperuser;grant fw_schema_owner to qa_migrator");
    await db.exec("set role qa_migrator");
    try { await db.exec("alter function private.audit_chain_verify() set timezone to 'UTC'"); } finally { await db.exec("reset role"); }
    await db.exec("set role qa_outsider");
    try { await expect(db.exec("alter function private.audit_chain_verify() set timezone to 'UTC'")).rejects.toThrow(/owner|permission|schema/i); } finally { await db.exec("reset role"); }
  });

  it("rolls back by resetting the setting, without touching any data, and re-applies cleanly", async () => {
    const snap = await snapshot();
    await db.exec("alter function private.audit_chain_append() reset timezone;alter function private.audit_chain_verify() reset timezone");
    expect((await meta()).every(row => row.tz === "")).toBe(true);
    expect(await snapshot()).toEqual(snap);
    expect((await verifyIn("UTC")).ok).toBe(true);
    await db.exec(await readFile(`supabase/migrations/${PIN}`, "utf8"));
    expect(await snapshot()).toEqual(snap);
    expect((await verifyIn("Asia/Colombo")).ok).toBe(true);
  });

  it("the pre-apply check (verify from a UTC session) predicts whether verification survives the pin", async () => {
    // A link chained by a non-UTC session before the pin is the only case the pin can invalidate. Reproduce it, run the check, apply, compare.
    await db.exec("alter function private.audit_chain_append() reset timezone;alter function private.audit_chain_verify() reset timezone");
    expect((await verifyIn("UTC")).ok).toBe(true);
    await writeIn("Asia/Colombo", "Chained by a non-UTC session before the pin");
    const predicted = (await verifyIn("UTC")).ok;
    expect(predicted, "a link chained outside UTC must be caught by the UTC pre-check").toBe(false);
    await db.exec(await readFile(`supabase/migrations/${PIN}`, "utf8"));
    expect((await verifyIn("UTC")).ok).toBe(predicted);
    expect((await verifyIn("Asia/Colombo")).ok).toBe(predicted);
  });
});

it("the migration file matches its recorded checksum and contains nothing but the two function settings", async () => {
  const text = await readFile(`supabase/migrations/${PIN}`, "utf8");
  const recorded = /'20261029170000_audit_chain_timezone_pin\.sql', '([0-9a-f]{64})'/.exec(await readFile("scripts/prepare-local-development.mjs", "utf8"))![1];
  expect(createHash("sha256").update(text).digest("hex")).toBe(recorded);
  const statements = text.split("\n").filter(line => line && !line.startsWith("--") && !/^(begin|commit);$/.test(line) && !line.startsWith("do $$"));
  expect(statements).toEqual(["alter function private.audit_chain_append() set timezone to 'UTC';", "alter function private.audit_chain_verify() set timezone to 'UTC';"]);
});
