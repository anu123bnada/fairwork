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
    await runMigration(await readFile("supabase/migrations/20261028140000_recruiter_verification.sql", "utf8"));
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
const claim = (over: Record<string, unknown> = {}) => {
  const id = crypto.randomUUID();
  return { verificationId: id, companyId: COMPANY, recruiterName: "Synthetic Recruiter", claimedEmployer: "Synthetic Day 3 company", roleTitle: "Hiring coordinator", email: "recruiter@synthetic-employer.example.test", profileUrl: "https://profiles.example.test/synthetic", employerSite: "https://synthetic-employer.example.test", postingUrl: "https://synthetic-employer.example.test/jobs/1", registryLei: null, noticeVersion: "recruiter-verification.v1", idempotencyKey: id, ...over };
};
const decide = (verificationId: unknown, decision: string, over: Record<string, unknown> = {}) => ({ verificationId, decision, reason: "Synthetic representative statement", validDays: decision === "confirm" ? 90 : null, idempotencyKey: crypto.randomUUID(), ...over });
const asRep = (sql: string, params: unknown[], actor: string) => run(sql, params, claims(actor), "fw_user_exec");

describe("employer domain claims", () => {
  it("lets an approved representative claim a domain, shows the public token to people related to the company, and keeps strangers out", async () => {
    await clearQuotas();
    const first = await rpc("company_domain_claim", { companyId: COMPANY, domain: "Synthetic-Employer.example.test" }, APPROVER);
    expect(first).toMatchObject({ domain: "synthetic-employer.example.test", replayed: false }); expect(String(first.token)).toMatch(/^[0-9a-f]{40}$/);
    expect(await rpc("company_domain_claim", { companyId: COMPANY, domain: "synthetic-employer.example.test" }, MEMBER)).toMatchObject({ domainId: first.domainId, token: first.token, replayed: true });
    await expect(rpc("company_domain_claim", { companyId: COMPANY, domain: "other.example.test" }, OTHER)).rejects.toThrow("ACTION_FORBIDDEN");
    expect((await rpc("company_domain_list", { companyId: COMPANY }, OTHER)).items).toEqual([]); // not related yet
    const verification = claim(); await rpc("recruiter_create", verification);
    expect((await rpc("company_domain_list", { companyId: COMPANY }, OTHER)).items).toEqual([expect.objectContaining({ domain: "synthetic-employer.example.test", token: first.token })]);
    for (const bad of ["no-dot", "-bad.example.test", "bad_.example.test", "http://x.example.test", "a..b.test", "x".repeat(64) + ".test", "spaces here.test", ""]) await expect(rpc("company_domain_claim", { companyId: COMPANY, domain: bad }, APPROVER), bad).rejects.toThrow("VALIDATION_FAILED");
    await rpc("recruiter_delete", { verificationId: verification.verificationId });
  });
  it("removes a domain, refuses to re-claim it, enforces five per company and refuses non-representatives", async () => {
    await clearQuotas();
    const made = await rpc("company_domain_claim", { companyId: COMPANY, domain: "remove-me.example.test" }, WORKER);
    await expect(rpc("company_domain_remove", { domainId: made.domainId }, OTHER)).rejects.toThrow("NOT_FOUND");
    expect(await rpc("company_domain_remove", { domainId: made.domainId }, MEMBER)).toEqual({ domainId: made.domainId, removed: true });
    expect(await rpc("company_domain_remove", { domainId: made.domainId }, MEMBER)).toEqual({ domainId: made.domainId, removed: true });
    await expect(rpc("company_domain_claim", { companyId: COMPANY, domain: "remove-me.example.test" }, WORKER)).rejects.toThrow("VERSION_CONFLICT");
    for (let i = 0; i < 4; i += 1) await rpc("company_domain_claim", { companyId: COMPANY, domain: `extra${i}.example.test` }, APPROVER);
    await expect(rpc("company_domain_claim", { companyId: COMPANY, domain: "one-too-many.example.test" }, APPROVER)).rejects.toThrow("RATE_LIMITED");
    expect(((await rpc("company_domain_list", { companyId: COMPANY }, APPROVER)).items as unknown[]).length).toBe(5);
  });
});

describe("recruiter verification requests", () => {
  it("finds only employers that currently have an approved representative, by name prefix, and refuses wildcards and short queries", async () => {
    await clearQuotas();
    expect((await rpc("recruiter_company_search", { query: "Synthetic Day" })).items).toEqual([{ companyId: COMPANY, name: "Synthetic Day 3 company" }]);
    expect((await rpc("recruiter_company_search", { query: "synthetic day 3" })).items).toHaveLength(1);
    expect((await rpc("recruiter_company_search", { query: "Nothing like this" })).items).toEqual([]);
    expect((await rpc("recruiter_company_search", { query: "ay 3 company" })).items).toEqual([]); // a prefix, not a substring
    for (const bad of ["abc", "a%b%c%", "under_score", "back\\slash", "x".repeat(81)]) await expect(rpc("recruiter_company_search", { query: bad }), bad).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("recruiter_company_search", { query: "Synthetic" }, null)).rejects.toThrow();
  });

  it("stores an immutable claim for its requester, replays safely, and rejects malformed claims", async () => {
    await clearQuotas();
    const request = claim();
    expect(await rpc("recruiter_create", request)).toEqual({ verificationId: request.verificationId, replayed: false });
    expect(await rpc("recruiter_create", request)).toEqual({ verificationId: request.verificationId, replayed: true });
    await expect(rpc("recruiter_create", { ...request, recruiterName: "Someone Else" })).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    const read = await rpc("recruiter_read", { verificationId: request.verificationId });
    expect(read).toMatchObject({ recruiterName: "Synthetic Recruiter", email: "recruiter@synthetic-employer.example.test", companyId: COMPANY, employer: { confirmations: 0, disputes: 0 }, decisions: [] });
    expect(new Date(String(read.expiresAt)).getTime() - new Date(String(read.createdAt)).getTime()).toBe(90 * 86_400_000);
    for (const bad of [{ recruiterName: "x" }, { recruiterName: "  " }, { claimedEmployer: "" }, { email: "not an email" }, { email: "a b@c.d" }, { profileUrl: "http://insecure.example.test" }, { postingUrl: "javascript:alert(1)" }, { employerSite: "https://has space.test" }, { registryLei: "short" }, { noticeVersion: "other" }, { companyId: crypto.randomUUID() }])
      await expect(rpc("recruiter_create", claim(bad)), JSON.stringify(bad).slice(0, 50)).rejects.toThrow(/VALIDATION_FAILED|NOT_FOUND/);
    await expect(rpc("recruiter_create", { ...claim(), extra: "x" })).rejects.toThrow("VALIDATION_FAILED");
    await expect(rpc("recruiter_create", claim(), null)).rejects.toThrow();
    expect((await rpc("recruiter_create", claim({ companyId: null, email: null, profileUrl: null, employerSite: null, postingUrl: null, roleTitle: null }))).replayed).toBe(false); // an employer not on ORYQEN is allowed
    await rpc("recruiter_delete", { verificationId: request.verificationId });
  });

  it("keeps a claim private to its requester and the named company's representatives, who never learn the requester", async () => {
    await clearQuotas();
    const request = claim(); await rpc("recruiter_create", request);
    await expect(rpc("recruiter_read", { verificationId: request.verificationId }, WORKER)).rejects.toThrow("NOT_FOUND"); // even a representative cannot use the requester's read
    expect((await rpc("recruiter_list", {}, APPROVER)).items).toEqual([]);
    const queue = await rpc("recruiter_queue", { cursor: null }, APPROVER);
    expect(queue.items).toEqual([expect.objectContaining({ verificationId: request.verificationId, recruiterName: "Synthetic Recruiter", companyName: "Synthetic Day 3 company", mine: null })]);
    expect(JSON.stringify(queue)).not.toContain(OTHER); expect(Object.keys((queue.items as Record<string, unknown>[])[0]!)).not.toContain("requesterId");
    expect((await rpc("recruiter_queue", { cursor: null }, OTHER)).items).toEqual([]); // not a representative
    expect(await asRep("select id from private.recruiter_verifications where id=$1", [request.verificationId], MEMBER)).toHaveLength(1);
    expect(await asRep("select id from private.recruiter_verifications where id=$1", [request.verificationId], APPROVER)).toHaveLength(1);
    await rpc("recruiter_delete", { verificationId: request.verificationId });
  });

  it("limits each person to twenty live claims and frees room on deletion", async () => {
    await clearQuotas();
    const made: string[] = [];
    for (let i = 0; i < 20; i += 1) { if (i % 8 === 0) await clearQuotas(); const request = claim(); made.push(request.verificationId); await rpc("recruiter_create", request, MEMBER); }
    await clearQuotas();
    await expect(rpc("recruiter_create", claim(), MEMBER)).rejects.toThrow("RATE_LIMITED");
    await rpc("recruiter_delete", { verificationId: made[0] }, MEMBER); await rpc("recruiter_create", claim(), MEMBER);
    for (const [index, id] of made.slice(1).entries()) { if (index % 8 === 0) await clearQuotas(); await rpc("recruiter_delete", { verificationId: id }, MEMBER); }
    await clearQuotas();
    for (const [index, item] of ((await rpc("recruiter_list", {}, MEMBER)).items as { verificationId: string }[]).entries()) { if (index % 8 === 0) await clearQuotas(); await rpc("recruiter_delete", { verificationId: item.verificationId }, MEMBER); }
  });
});

describe("employer decisions", () => {
  it("lets approved representatives confirm, dispute and withdraw, and reports the current state to the requester without naming anyone", async () => {
    await clearQuotas();
    const request = claim(); await rpc("recruiter_create", request);
    const confirmed = await rpc("recruiter_decide", decide(request.verificationId, "confirm"), APPROVER);
    expect(confirmed).toMatchObject({ decision: "confirm", replayed: false });
    expect(new Date(String(confirmed.validUntil)).getTime() - Date.now()).toBeGreaterThan(89 * 86_400_000);
    let read = await rpc("recruiter_read", { verificationId: request.verificationId });
    expect(read.employer).toMatchObject({ confirmations: 1, disputes: 0 }); expect(read.employer).toHaveProperty("confirmedUntil");
    await rpc("recruiter_decide", decide(request.verificationId, "dispute", { reason: "This person does not work for us" }), MEMBER);
    read = await rpc("recruiter_read", { verificationId: request.verificationId });
    expect(read.employer).toMatchObject({ confirmations: 1, disputes: 1 });
    expect((read.decisions as { decision: string }[]).map(item => item.decision).sort()).toEqual(["confirm", "dispute"]);
    expect(JSON.stringify(read)).not.toMatch(new RegExp(`${APPROVER}|${MEMBER}`)); // the requester sees what was decided, never who decided
    await rpc("recruiter_decide", decide(request.verificationId, "withdraw", { reason: "I was mistaken" }), APPROVER);
    read = await rpc("recruiter_read", { verificationId: request.verificationId });
    expect(read.employer).toMatchObject({ confirmations: 0, disputes: 1 });
    expect(((await rpc("recruiter_queue", { cursor: null }, APPROVER)).items as { mine: { decision: string } }[]).find(item => item)?.mine).toMatchObject({ decision: "withdraw" });
    await rpc("recruiter_delete", { verificationId: request.verificationId });
  });

  it("refuses everyone who is not an approved representative of that company, the requester themselves, and malformed or conflicting decisions", async () => {
    await clearQuotas();
    const request = claim(); await rpc("recruiter_create", request);
    await expect(rpc("recruiter_decide", decide(request.verificationId, "confirm"), OTHER)).rejects.toThrow("NOT_FOUND");
    const own = claim(); await rpc("recruiter_create", own, APPROVER);
    await expect(rpc("recruiter_decide", decide(own.verificationId, "confirm"), APPROVER)).rejects.toThrow("ACTION_FORBIDDEN"); // a representative cannot confirm their own claim
    const unnamed = claim({ companyId: null }); await rpc("recruiter_create", unnamed);
    await expect(rpc("recruiter_decide", decide(unnamed.verificationId, "confirm"), APPROVER)).rejects.toThrow("NOT_FOUND"); // no company named, nobody can confirm
    for (const bad of [decide(request.verificationId, "confirm", { validDays: 181 }), decide(request.verificationId, "confirm", { validDays: 0 }), decide(request.verificationId, "confirm", { validDays: null }), decide(request.verificationId, "dispute", { validDays: 30 }), decide(request.verificationId, "confirm", { reason: "  " }), decide(request.verificationId, "maybe"), decide(request.verificationId, "withdraw")])
      await expect(rpc("recruiter_decide", bad, APPROVER), JSON.stringify(bad).slice(0, 80)).rejects.toThrow("VALIDATION_FAILED");
    const first = decide(request.verificationId, "confirm");
    await rpc("recruiter_decide", first, APPROVER);
    expect(await rpc("recruiter_decide", first, APPROVER)).toMatchObject({ replayed: true });
    await expect(rpc("recruiter_decide", { ...first, decision: "dispute", validDays: null, reason: "x" }, APPROVER)).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    await asRep("delete from private.recruiter_decisions where verification_id=$1", [request.verificationId], APPROVER); // row security hides the row from a representative: nothing is deleted
    expect(await asRep("select id from private.recruiter_decisions where verification_id=$1", [request.verificationId], APPROVER)).toHaveLength(1);
    await expect(asRep("update private.recruiter_decisions set reason='changed' where verification_id=$1", [request.verificationId], APPROVER)).rejects.toThrow();
    for (const id of [request.verificationId]) await rpc("recruiter_delete", { verificationId: id });
    await rpc("recruiter_delete", { verificationId: own.verificationId }, APPROVER); await rpc("recruiter_delete", { verificationId: unnamed.verificationId });
  });

  it("lets the requester erase a claim with its decisions, leaving only a personal-data-free audit event, and erases expired claims on the next look", async () => {
    await clearQuotas();
    const request = claim(); await rpc("recruiter_create", request);
    await rpc("recruiter_decide", decide(request.verificationId, "confirm"), APPROVER);
    await expect(rpc("recruiter_delete", { verificationId: request.verificationId }, WORKER)).rejects.toThrow("NOT_FOUND");
    expect(await rpc("recruiter_delete", { verificationId: request.verificationId })).toEqual({ verificationId: request.verificationId, deleted: true });
    await expect(rpc("recruiter_read", { verificationId: request.verificationId })).rejects.toThrow("NOT_FOUND");
    expect((await rpc("recruiter_queue", { cursor: null }, APPROVER)).items).toEqual([]);
    const events = await asRep("select kind from private.recruiter_events where verification_id=$1 order by at,kind", [request.verificationId], APPROVER);
    expect(events.map(row => (row as { kind: string }).kind).sort()).toEqual(["confirm", "created", "deleted"]);
    const columns = await db.query<{ column_name: string }>("select column_name from information_schema.columns where table_schema='private' and table_name='recruiter_events'");
    expect(columns.rows.map(row => row.column_name).sort()).toEqual(["at", "company_id", "id", "kind", "verification_id"]);
    // An expired claim, written as the database owner (the application can never create one), disappears for its requester.
    await db.exec("reset role");
    const expired = crypto.randomUUID();
    await db.query("insert into private.recruiter_verifications(id,requester_id,company_id,recruiter_name,claimed_employer,notice_version,idempotency_key,created_at,expires_at) values($1,$2,$3,'Old Recruiter','Old Employer','recruiter-verification.v1',$1,'2026-01-01T00:00:00Z','2026-04-01T00:00:00Z')", [expired, OTHER, COMPANY]);
    await clearQuotas();
    expect(((await rpc("recruiter_list", {})).items as { verificationId: string }[]).some(item => item.verificationId === expired)).toBe(false);
    expect(await db.query("select 1 from private.recruiter_verifications where id=$1", [expired]).then(result => result.rows)).toEqual([]);
  });
});
