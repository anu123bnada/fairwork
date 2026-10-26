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
          ('${MEMBER}','authority_operator','${APPROVER}','Local synthetic Day 3 fixture',now()+interval '1 day'),
          ('${APPROVER}','review_operator','${MEMBER}','Local synthetic fixture',now()+interval '1 day'),
          ('${MEMBER}','review_operator','${APPROVER}','Local synthetic fixture',now()+interval '1 day');
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
    await runMigration(await readFile("supabase/migrations/20261028140000_recruiter_verification.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/20261024052407_opportunity_discovery.sql", "utf8"));
    await runMigration(await readFile("supabase/migrations/20261028180000_abuse_reports.sql", "utf8"));
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

// WORKER, APPROVER and MEMBER are approved representatives of COMPANY in this fixture; OTHER is an ordinary person with no authority.
const rpc = async (name: string, request: unknown, actor: string | null = OTHER) => (await run<{ value: Record<string, unknown> }>(`select api.${name}($1::jsonb) value`, [request], actor ? claims(actor) : {}, actor ? "authenticated" : "anon"))[0]!.value;

const rid = () => crypto.randomUUID();
const report = (over: Record<string, unknown> = {}) => { const id = rid(); return { reportId: id, subjectKind: "other", subjectRef: null, subjectLabel: "Synthetic recruiter named in a message", category: "fee_request", details: "Asked me to pay a registration fee by gift card before any contract.", idempotencyKey: id, ...over }; };
const opRpc = (name: string, request: unknown, actor: string, aal = "aal2") => run<{ value: Record<string, unknown> }>(`select api.${name}($1::jsonb) value`, [request], claims(actor, aal), "authenticated").then(rows => rows[0]!.value);

describe("abuse reports", () => {
  it("lets a person file a report, replays it, and lists only their own", async () => {
    await clearQuotas();
    const body = report();
    expect(await rpc("report_create", body, OTHER)).toEqual({ reportId: body.reportId, replayed: false });
    expect(await rpc("report_create", body, OTHER)).toEqual({ reportId: body.reportId, replayed: true });
    await expect(rpc("report_create", { ...body, details: "A different statement of the problem entirely." }, OTHER)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    const mine = (await rpc("report_list", {}, OTHER)).items as { reportId: string; status: string; events: { event: string }[] }[];
    expect(mine.map(item => item.reportId)).toContain(body.reportId);
    expect(mine.find(item => item.reportId === body.reportId)).toMatchObject({ status: "received", events: [{ event: "received" }] });
    expect(((await rpc("report_list", {}, WORKER)).items as unknown[]).length).toBe(0);
  });

  it("only accepts references the reporter can already see, and validates every field", async () => {
    await clearQuotas();
    await expect(rpc("report_create", report({ subjectKind: "recruiter_check", subjectRef: rid() }), OTHER)).rejects.toThrow("NOT_FOUND");
    await expect(rpc("report_create", report({ subjectKind: "recruiter_check", subjectRef: null }), OTHER)).rejects.toThrow("NOT_FOUND");
    await expect(rpc("report_create", report({ subjectKind: "listing", subjectRef: rid() }), OTHER)).rejects.toThrow("NOT_FOUND");
    await expect(rpc("report_create", report({ category: "gossip" }), OTHER)).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("report_create", report({ details: "short" }), OTHER)).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("report_create", { ...report(), extra: 1 }, OTHER)).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("report_create", report(), null)).rejects.toThrow();
    const check = rid();
    await rpc("recruiter_create", { verificationId: check, companyId: COMPANY, recruiterName: "Synthetic Recruiter", claimedEmployer: "Synthetic Day 3 company", roleTitle: null, email: null, profileUrl: null, employerSite: null, postingUrl: null, registryLei: null, noticeVersion: "recruiter-verification.v1", idempotencyKey: check }, OTHER);
    expect(await rpc("report_create", report({ subjectKind: "recruiter_check", subjectRef: check }), OTHER)).toMatchObject({ replayed: false });
    await expect(rpc("report_create", report({ subjectKind: "recruiter_check", subjectRef: check }), WORKER)).rejects.toThrow("NOT_FOUND"); // someone else's check
  });

  it("limits a reporter to ten reports a day", async () => {
    await clearQuotas();
    for (let index = 0; index < 10; index += 1) { await clearQuotas(); await rpc("report_create", report(), MEMBER); }
    await clearQuotas();
    await expect(rpc("report_create", report(), MEMBER)).rejects.toThrow("RATE_LIMITED");
  });

  it("gives reviewers a queue without the reporter's identity, and keeps everyone else out", async () => {
    await clearQuotas();
    const body = report({ subjectLabel: "Synthetic queue subject" }); await rpc("report_create", body, OTHER);
    const queue = (await opRpc("report_queue", {}, APPROVER)).items as Record<string, unknown>[];
    const found = queue.find(item => item.reportId === body.reportId)!;
    expect(found).toMatchObject({ status: "received", revision: 0, subjectLabel: "Synthetic queue subject", own: false });
    expect(JSON.stringify(queue)).not.toContain(OTHER);
    await expect(opRpc("report_queue", {}, WORKER)).rejects.toThrow("ACTION_FORBIDDEN");
    await expect(opRpc("report_queue", {}, APPROVER, "aal1")).rejects.toThrow("MFA_REQUIRED");
    await expect(opRpc("report_queue", { status: "everything" }, APPROVER)).rejects.toThrow("VALIDATION_FAILED");
    await expect(run("select * from private.abuse_reports", [], claims(WORKER), "fw_user_exec").then(rows => rows.length)).resolves.toBe(0); // row security hides others' reports
  });

  it("lets a reviewer move a report forward with notes, enforces versions, and writes back to the reporter", async () => {
    await clearQuotas();
    const body = report(); await rpc("report_create", body, OTHER);
    await expect(opRpc("report_review", { reportId: body.reportId, expectedRevision: 0, event: "closed_actioned" }, APPROVER)).rejects.toThrow("VALIDATION_FAILED"); // closing needs a note
    expect(await opRpc("report_review", { reportId: body.reportId, expectedRevision: 0, event: "reviewing" }, APPROVER)).toMatchObject({ status: "reviewing", revision: 1 });
    await expect(opRpc("report_review", { reportId: body.reportId, expectedRevision: 0, event: "needs_information", note: "Which message?" }, MEMBER)).rejects.toThrow("VERSION_CONFLICT");
    expect(await opRpc("report_review", { reportId: body.reportId, expectedRevision: 1, event: "needs_information", note: "Which message did this come from?" }, MEMBER)).toMatchObject({ revision: 2 });
    expect(await opRpc("report_review", { reportId: body.reportId, expectedRevision: 2, event: "closed_no_action", note: "Evidence was not sufficient to act." }, APPROVER)).toMatchObject({ status: "closed_no_action", revision: 3 });
    await expect(opRpc("report_review", { reportId: body.reportId, expectedRevision: 3, event: "reviewing" }, APPROVER)).rejects.toThrow("VERSION_CONFLICT"); // closed
    const mine = ((await rpc("report_list", {}, OTHER)).items as { reportId: string; status: string; events: { event: string; note: string | null }[] }[]).find(item => item.reportId === body.reportId)!;
    expect(mine.status).toBe("closed_no_action");
    expect(mine.events.map(event => event.event)).toEqual(["received", "reviewing", "needs_information", "closed_no_action"]);
    expect(mine.events[2]!.note).toBe("Which message did this come from?");
    const closed = (await opRpc("report_queue", { status: "closed" }, APPROVER)).items as { reportId: string }[];
    expect(closed.map(item => item.reportId)).toContain(body.reportId);
  });

  it("stops reviewers from reviewing their own report and reporters from reviewing at all", async () => {
    await clearQuotas();
    const own = report(); await rpc("report_create", own, APPROVER);
    await expect(opRpc("report_review", { reportId: own.reportId, expectedRevision: 0, event: "reviewing" }, APPROVER)).rejects.toThrow("ACTION_FORBIDDEN");
    await expect(opRpc("report_review", { reportId: own.reportId, expectedRevision: 0, event: "reviewing" }, OTHER)).rejects.toThrow("ACTION_FORBIDDEN");
    expect(await opRpc("report_review", { reportId: own.reportId, expectedRevision: 0, event: "reviewing" }, MEMBER)).toMatchObject({ status: "reviewing" });
    await expect(opRpc("report_review", { reportId: rid(), expectedRevision: 0, event: "reviewing" }, MEMBER)).rejects.toThrow("NOT_FOUND");
  });

  it("lets only the reporter withdraw an open report, and only once", async () => {
    await clearQuotas();
    const body = report(); await rpc("report_create", body, OTHER);
    await expect(rpc("report_withdraw", { reportId: body.reportId }, WORKER)).rejects.toThrow("NOT_FOUND");
    expect(await rpc("report_withdraw", { reportId: body.reportId }, OTHER)).toMatchObject({ status: "withdrawn" });
    await expect(rpc("report_withdraw", { reportId: body.reportId }, OTHER)).rejects.toThrow("VERSION_CONFLICT");
    await expect(opRpc("report_review", { reportId: body.reportId, expectedRevision: 1, event: "reviewing" }, APPROVER)).rejects.toThrow("VERSION_CONFLICT");
  });

  it("keeps reports and their events append-only", async () => {
    await clearQuotas();
    const body = report(); await rpc("report_create", body, OTHER);
    await expect(run("update private.abuse_reports set details='tampered statement of the problem' where id=$1", [body.reportId], claims(OTHER), "fw_user_exec")).rejects.toThrow();
    await expect(run("delete from private.abuse_report_events where report_id=$1", [body.reportId], claims(OTHER), "fw_user_exec")).rejects.toThrow();
    await expect(run("insert into private.abuse_report_events(report_id,actor_id,event,revision) values($1,$2,'closed_actioned',1)", [body.reportId, OTHER], claims(OTHER), "fw_user_exec")).rejects.toThrow(); // a reporter cannot close their own report
  });
});
