import { beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";

const db = new PGlite();
const WORKER = "40000000-0000-4000-8000-000000000012";
const APPROVER = "40000000-0000-4000-8000-000000000013";
const MEMBER = "40000000-0000-4000-8000-000000000014";
let COMPANY: string;

function claims(id: string, aal = "aal2") {
  return { sub: id, role: "authenticated", aal, is_anonymous: false };
}

async function run<T = Record<string, unknown>>(sql: string, params: unknown[] = [], jwt = claims(APPROVER), role = "authenticated") {
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
  for (const id of [WORKER, APPROVER, MEMBER]) {
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
  } catch (error) {
    await db.exec("rollback").catch(() => undefined);
    throw error;
  } finally {
    await db.exec("reset role");
  }
  await db.exec("revoke create on schema private from postgres");
  await db.exec("insert into supabase_migrations.schema_migrations values('202610100001')");
});

describe("Day 3 offer and agreement database path", () => {
  it("passes the read-only hosted catalog checklist against the local migrated PostgreSQL fixture", async () => {
    const results = await db.exec(await readFile("scripts/day3-hosted-catalog.sql", "utf8"));
    const catalog = results.find((result) => result.command === "SELECT");
    expect(catalog?.rows).toHaveLength(12);
    expect(catalog?.rows.map((row) => row.result)).toEqual(Array(12).fill("PASS"));
  });

  it("accepts an authenticated employer offer review and persists the result", async () => {
    const terms = {
      salary: 120000,
      currency: "USD",
      startDate: "2027-01-15",
      hoursPerWeek: 40,
      responsibilities: "Ship the MVP and review churn risk.",
    };

    const payload = {
      offerId: "40000000-0000-4000-8000-000000000021",
      companyId: COMPANY,
      workerId: WORKER,
      requesterRole: "EMPLOYER",
      terms,
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
    };
    const rows = await run(
      `select api.review_offer($1::jsonb) as value`,
      [payload],
      claims(APPROVER),
    );

    expect(rows[0]).toMatchObject({ value: expect.objectContaining({ companyId: COMPANY, requesterRole: "EMPLOYER", version: 1 }) });
    expect(await run(`select api.review_offer($1::jsonb) as value`, [payload], claims(APPROVER))).toMatchObject([
      { value: expect.objectContaining({ offerId: payload.offerId, idempotent: true }) },
    ]);
    await expect(run(`select api.review_offer($1::jsonb) as value`, [
      { ...payload, terms: { ...terms, salary: 125000 } },
    ], claims(APPROVER))).rejects.toMatchObject({ message: "IDEMPOTENCY_CONFLICT" });
    const count = await run(`select count(*)::int as n from private.day3_offers`, [], claims(APPROVER), "fw_user_exec");
    expect(count[0]).toMatchObject({ n: 1 });
  });

  it("derives and persists unresolved terms in PostgreSQL rather than accepting a client resolution", async () => {
    const result = await run(`select api.review_offer($1::jsonb) as value`, [{
      offerId: "40000000-0000-4000-8000-000000000031",
      companyId: COMPANY,
      workerId: WORKER,
      requesterRole: "EMPLOYER",
      terms: { salary: 0, currency: "USD", startDate: "2027-01-15", hoursPerWeek: 40, responsibilities: "" },
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
    }], claims(APPROVER));
    expect(result[0]).toMatchObject({ value: { unresolved: expect.arrayContaining([
      expect.objectContaining({ field: "salary" }),
      expect.objectContaining({ field: "responsibilities" }),
    ]) } });
    const stored = await run(`select unresolved from private.day3_offers where offer_id = $1`, [
      "40000000-0000-4000-8000-000000000031",
    ], claims(APPROVER), "fw_user_exec");
    expect(stored[0]).toMatchObject({ unresolved: expect.arrayContaining([
      expect.objectContaining({ field: "salary" }),
      expect.objectContaining({ field: "responsibilities" }),
    ]) });
  });

  it("records immutable participant answers and blocks agreement until every required question is answered", async () => {
    const offerId = "40000000-0000-4000-8000-000000000051";
    await run(`select api.review_offer($1::jsonb) as value`, [{
      offerId,
      companyId: COMPANY,
      workerId: WORKER,
      requesterRole: "EMPLOYER",
      terms: { salary: 0, currency: "USD", startDate: "2027-01-15", hoursPerWeek: 40, responsibilities: "" },
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
    }], claims(APPROVER));
    const questions = await run<{ id: string; field: string }>(
      `select q.id::text as id, q.field from private.day3_offer_questions q
       where q.offer_id = $1 order by q.field`,
      [offerId],
      claims(APPROVER),
      "fw_user_exec",
    );
    expect(questions.map((question) => question.field)).toEqual(["responsibilities", "salary"]);

    const confirmation = {
      agreementId: "40000000-0000-4000-8000-000000000052",
      offerId,
      companyId: COMPANY,
      workerId: WORKER,
      confirmationRole: "EMPLOYER",
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
    };
    await expect(run(`select api.confirm_agreement($1::jsonb) as value`, [confirmation], claims(APPROVER)))
      .rejects.toMatchObject({ message: "VALIDATION_FAILED" });

    const answerOne = {
      offerId,
      offerVersion: 1,
      questionId: questions.find((question) => question.field === "salary")!.id,
      answer: "The amount is still under discussion.",
      idempotencyKey: crypto.randomUUID(),
    };
    const first = await run(`select api.answer_offer_question($1::jsonb) as value`, [answerOne], claims(WORKER));
    expect(first[0]).toMatchObject({ value: { answeredBy: WORKER, answer: answerOne.answer, idempotent: false } });
    expect(await run(`select api.answer_offer_question($1::jsonb) as value`, [answerOne], claims(WORKER))).toMatchObject([
      { value: expect.objectContaining({ idempotent: true, answer: answerOne.answer }) },
    ]);
    await expect(run(`select api.answer_offer_question($1::jsonb) as value`, [
      { ...answerOne, answer: "A changed answer", idempotencyKey: crypto.randomUUID() },
    ], claims(WORKER))).rejects.toMatchObject({ message: "IDEMPOTENCY_CONFLICT" });

    const answerTwo = {
      ...answerOne,
      questionId: questions.find((question) => question.field === "responsibilities")!.id,
      answer: "The parties will finalize the description in the amendment.",
      idempotencyKey: crypto.randomUUID(),
    };
    await run(`select api.answer_offer_question($1::jsonb) as value`, [answerTwo], claims(APPROVER));
    const stored = await run<{ n: number }>(
      `select count(*)::int as n from private.day3_offer_answers where offer_id = $1 and offer_version = 1`,
      [offerId],
      claims(APPROVER),
      "fw_user_exec",
    );
    expect(stored[0]).toEqual({ n: 2 });
    const frozenHashes = await run<{ termHash: string; agreementHash: string }>(
      `select o.term_hash as "termHash",
         private.day3_hash_agreement(o.snapshot, o.unresolved) as "agreementHash"
       from private.day3_offers o where o.offer_id = $1 and o.version = 1`,
      [offerId],
      claims(APPROVER),
      "fw_user_exec",
    );
    expect(frozenHashes[0]?.agreementHash).not.toBe(frozenHashes[0]?.termHash);
    const confirmed = await run(`select api.confirm_agreement($1::jsonb) as value`, [{
      ...confirmation,
      idempotencyKey: crypto.randomUUID(),
    }], claims(APPROVER));
    expect(confirmed[0]).toMatchObject({
      value: {
        status: "awaiting_other_party",
        currentHash: frozenHashes[0]?.agreementHash,
      },
    });
  });

  it("ignores forged identity claims and rejects unauthorized companies and stale revisions", async () => {
    const baseOffer = {
      offerId: "40000000-0000-4000-8000-000000000041",
      companyId: COMPANY,
      workerId: WORKER,
      requesterRole: "EMPLOYER",
      terms: { salary: 120000, currency: "USD", startDate: "2027-01-15", hoursPerWeek: 40, responsibilities: "Ship the MVP." },
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
    };
    const forgedIdentityResult = await run(`select api.review_offer($1::jsonb) as value`, [
      { ...baseOffer, requesterId: MEMBER },
    ], claims(APPROVER));
    expect(forgedIdentityResult[0]).toMatchObject({
      value: { requesterId: APPROVER, offerId: baseOffer.offerId },
    });
    await expect(run(`select api.review_offer($1::jsonb) as value`, [
      { ...baseOffer, offerId: "40000000-0000-4000-8000-000000000042", companyId: "40000000-0000-4000-8000-000000000099" },
    ], claims(APPROVER))).rejects.toMatchObject({ message: "ACTION_FORBIDDEN" });

    const payload = {
      agreementId: "40000000-0000-4000-8000-000000000022",
      offerId: "40000000-0000-4000-8000-000000000021",
      companyId: COMPANY,
      workerId: WORKER,
      confirmationRole: "EMPLOYER",
      expectedVersion: 99,
      idempotencyKey: crypto.randomUUID(),
    };

    await expect(run(`select api.confirm_agreement($1::jsonb) as value`, [payload], claims(MEMBER))).rejects.toMatchObject({ message: "ACTION_FORBIDDEN" });
    await expect(run(`select api.confirm_agreement($1::jsonb) as value`, [payload], claims(APPROVER))).rejects.toMatchObject({ message: "VERSION_CONFLICT" });

    await expect(run(`select api.review_offer($1::jsonb) as value`, [
      { ...baseOffer, expectedVersion: 3, idempotencyKey: crypto.randomUUID() },
    ], claims(APPROVER))).rejects.toMatchObject({ message: "VERSION_CONFLICT" });
  });

  it("appends immutable offer revisions and requires both independently authenticated parties", async () => {
    const amended = await run(`select api.review_offer($1::jsonb) as value`, [{
      offerId: "40000000-0000-4000-8000-000000000021",
      companyId: COMPANY,
      workerId: WORKER,
      requesterRole: "EMPLOYER",
      terms: { salary: 123000, currency: "USD", startDate: "2027-01-15", hoursPerWeek: 40, responsibilities: "Ship the MVP and document it." },
      expectedVersion: 2,
      idempotencyKey: crypto.randomUUID(),
    }], claims(APPROVER));
    expect(amended[0]).toMatchObject({ value: expect.objectContaining({ version: 2 }) });
    const latest = await run<{ hash: string }>(
      `select term_hash as hash from private.day3_offers where offer_id = $1 order by version desc limit 1`,
      ["40000000-0000-4000-8000-000000000021"],
      claims(APPROVER),
      "fw_user_exec",
    );
    const latestOffer = latest[0];
    if (!latestOffer) throw new Error("Expected an authoritative offer revision");
    const amendedHash = latestOffer.hash;
    const agreementHashes = await run<{ termHash: string; agreementHash: string }>(
      `select o.term_hash as "termHash",
         private.day3_hash_agreement(o.snapshot, o.unresolved) as "agreementHash"
       from private.day3_offers o where o.offer_id = $1 and o.version = 2`,
      ["40000000-0000-4000-8000-000000000021"],
      claims(APPROVER),
      "fw_user_exec",
    );
    const frozenAgreementHash = agreementHashes[0]?.agreementHash;
    expect(frozenAgreementHash).toBeTruthy();
    expect(frozenAgreementHash).not.toBe(amendedHash);
    const employerConfirmation = {
      agreementId: "40000000-0000-4000-8000-000000000022",
      offerId: "40000000-0000-4000-8000-000000000021",
      companyId: COMPANY,
      workerId: WORKER,
      confirmationRole: "EMPLOYER",
      confirmedBy: MEMBER,
      previousHash: "0".repeat(64),
      currentHash: "f".repeat(64),
      expectedVersion: 2,
      idempotencyKey: crypto.randomUUID(),
    };
    const result = await run(`select api.confirm_agreement($1::jsonb) as value`, [employerConfirmation], claims(APPROVER));

    expect(result[0]).toMatchObject({
      value: expect.objectContaining({
        status: "awaiting_other_party",
        currentHash: frozenAgreementHash,
        confirmedBy: APPROVER,
      }),
    });
    expect(await run(`select api.confirm_agreement($1::jsonb) as value`, [employerConfirmation], claims(APPROVER))).toMatchObject([
      { value: expect.objectContaining({ status: "awaiting_other_party", idempotent: true }) },
    ]);
    await expect(run(`select api.confirm_agreement($1::jsonb) as value`, [
      { ...employerConfirmation, idempotencyKey: crypto.randomUUID() },
    ], claims(APPROVER))).rejects.toMatchObject({ message: "ACTION_FORBIDDEN" });
    const workerConfirmation = await run(`select api.confirm_agreement($1::jsonb) as value`, [{
      agreementId: "40000000-0000-4000-8000-000000000022",
      offerId: "40000000-0000-4000-8000-000000000021",
      companyId: COMPANY,
      workerId: WORKER,
      confirmationRole: "WORKER",
      expectedVersion: 2,
      idempotencyKey: crypto.randomUUID(),
    }], claims(WORKER));
    expect(workerConfirmation[0]).toMatchObject({ value: expect.objectContaining({ status: "confirmed", confirmationRole: "WORKER" }) });
    expect((await run(`select agreement_id, offer_version, agreement_hash from private.day3_effective_agreements where offer_id = $1`, [
      "40000000-0000-4000-8000-000000000021",
    ], claims(APPROVER), "fw_user_exec"))[0]).toMatchObject({
      agreement_id: "40000000-0000-4000-8000-000000000022",
      offer_version: 2,
      agreement_hash: frozenAgreementHash,
    });
    await run(`select api.review_offer($1::jsonb) as value`, [{
      offerId: "40000000-0000-4000-8000-000000000021",
      companyId: COMPANY,
      workerId: WORKER,
      requesterRole: "EMPLOYER",
      terms: { salary: 124000, currency: "USD", startDate: "2027-01-15", hoursPerWeek: 40, responsibilities: "Ship the MVP and maintain it." },
      expectedVersion: 3,
      idempotencyKey: crypto.randomUUID(),
    }], claims(APPROVER));
    for (const [actor, confirmationRole] of [[APPROVER, "EMPLOYER"], [WORKER, "WORKER"]] as const) {
      await run(`select api.confirm_agreement($1::jsonb) as value`, [{
        agreementId: "40000000-0000-4000-8000-000000000023",
        offerId: "40000000-0000-4000-8000-000000000021",
        companyId: COMPANY,
        workerId: WORKER,
        confirmationRole,
        expectedVersion: 3,
        idempotencyKey: crypto.randomUUID(),
      }], claims(actor));
    }
    expect((await run(`select agreement_id, offer_version, company_id, worker_id from private.day3_effective_agreements where offer_id = $1`, [
      "40000000-0000-4000-8000-000000000021",
    ], claims(APPROVER), "fw_user_exec"))[0]).toEqual({
      agreement_id: "40000000-0000-4000-8000-000000000023",
      offer_version: 3,
      company_id: COMPANY,
      worker_id: WORKER,
    });
    const history = await run(`select count(*)::int as n from private.day3_agreements`, [], claims(APPROVER), "fw_user_exec");
    expect(history[0]).toMatchObject({ n: 5 });
    await expect(run(`update private.day3_agreements set current_hash = 'tampered'`, [], claims(APPROVER), "fw_user_exec"))
      .rejects.toMatchObject({ message: "ACTION_FORBIDDEN" });
    expect((await db.query(`select count(*)::int as n from private.audit_logs where action in ('review_offer','answer_offer_question','confirm_agreement')`)).rows)
      .toEqual([{ n: 13 }]);
    expect((await db.query(`select coalesce(sum(count), 0)::int as n from private.rate_limit_buckets where operation='day3_offer_write'`)).rows)
      .toEqual([{ n: 13 }]);
  });

  it("rechecks current employer authority after membership revocation", async () => {
    const revoked = await run(`select api.decide_membership($1::jsonb) as value`, [{
      companyId: COMPANY,
      subjectId: APPROVER,
      decision: "revoke",
      expectedRevision: 1,
      expiresAt: null,
      reviewedEvidenceRefs: ["demo:fixture/revocation"],
      reason: "Synthetic Day 3 revocation check",
      policyVersion: "demo-authority.v1",
      idempotencyKey: crypto.randomUUID(),
    }], claims(MEMBER));
    expect(revoked[0]).toMatchObject({ value: { active: false, decision: "revoke" } });

    await expect(run(`select api.review_offer($1::jsonb) as value`, [{
      offerId: "40000000-0000-4000-8000-000000000061",
      companyId: COMPANY,
      workerId: WORKER,
      requesterRole: "EMPLOYER",
      terms: { salary: 120000, currency: "USD", startDate: "2027-01-15", hoursPerWeek: 40, responsibilities: "Ship the MVP." },
      expectedVersion: 1,
      idempotencyKey: crypto.randomUUID(),
    }], claims(APPROVER))).rejects.toMatchObject({ message: "ACTION_FORBIDDEN" });
  });

  it("keeps Day 3 tables private and RPCs owned by the non-login executor", async () => {
    for (const role of ["anon", "authenticated", "service_role"]) {
      for (const table of [
        "day3_offers",
        "day3_offer_questions",
        "day3_offer_answers",
        "day3_agreements",
        "day3_effective_agreements",
        "day3_command_receipts",
      ]) {
        const privilege = await db.query<{ allowed: boolean }>(
          "select has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE') as allowed",
          [role, `private.${table}`],
        );
        expect(privilege.rows[0]!.allowed).toBe(false);
        await expect(run(`select * from private.${table}`, [], claims(APPROVER), role))
          .rejects.toMatchObject({ code: "42501" });
      }
    }
    const functions = await db.query<{ proname: string; owner: string; prosecdef: boolean; proconfig: string[] }>(`
      select p.proname, r.rolname as owner, p.prosecdef, p.proconfig
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
      where (n.nspname='api' and p.proname in ('review_offer','answer_offer_question','confirm_agreement'))
         or (n.nspname='private' and p.proname='day3_hash_agreement')
      order by p.proname
    `);
    expect(functions.rows).toHaveLength(4);
    for (const fn of functions.rows) {
      expect(fn).toMatchObject({ owner: "fw_user_exec", prosecdef: true });
      expect(fn.proconfig).toContain('search_path=""');
    }
    const membershipCheck = await db.query<{ owner: string; prosecdef: boolean; proconfig: string[] }>(`
      select r.rolname as owner, p.prosecdef, p.proconfig
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_roles r on r.oid=p.proowner
      where n.nspname='private' and p.proname='day3_authorized_company_role'
    `);
    expect(membershipCheck.rows).toEqual([{ owner: "fw_policy_exec", prosecdef: true, proconfig: ['search_path=""'] }]);
    const rpcGrants = await db.query<{ role: string; review: boolean; confirm: boolean }>(`
      select role,
        has_function_privilege(role, 'api.review_offer(jsonb)', 'EXECUTE') as review,
        has_function_privilege(role, 'api.answer_offer_question(jsonb)', 'EXECUTE') as answer,
        has_function_privilege(role, 'api.confirm_agreement(jsonb)', 'EXECUTE') as confirm
      from unnest(array['anon','authenticated','service_role']) as r(role)
    `);
    expect(rpcGrants.rows).toEqual([
      { role: "anon", review: false, answer: false, confirm: false },
      { role: "authenticated", review: true, answer: true, confirm: true },
      { role: "service_role", review: false, answer: false, confirm: false },
    ]);
    expect((await db.query<{ role: string; allowed: boolean }>(`
      select role, has_function_privilege(role, 'private.day3_hash_agreement(jsonb,jsonb)', 'EXECUTE') as allowed
      from unnest(array['anon','authenticated','service_role']) as r(role)
    `)).rows).toEqual([
      { role: "anon", allowed: false },
      { role: "authenticated", allowed: false },
      { role: "service_role", allowed: false },
    ]);
    expect((await db.query<{ n: number }>(`
      select count(*)::int as n
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'private' and c.relname in (
        'day3_offers','day3_offer_questions','day3_offer_answers','day3_agreements',
        'day3_effective_agreements','day3_command_receipts'
      )
        and c.relrowsecurity and c.relforcerowsecurity and pg_get_userbyid(c.relowner) = 'fw_schema_owner'
    `)).rows).toEqual([{ n: 6 }]);
    expect((await db.query<{ rolcanlogin: boolean; rolsuper: boolean; rolbypassrls: boolean }>(
      "select rolcanlogin, rolsuper, rolbypassrls from pg_roles where rolname='fw_user_exec'",
    )).rows).toEqual([{ rolcanlogin: false, rolsuper: false, rolbypassrls: false }]);
    expect((await db.query(`
      select has_schema_privilege('fw_user_exec','private','CREATE') as user_private_create,
        has_schema_privilege('fw_user_exec','api','CREATE') as user_api_create,
        has_schema_privilege('fw_policy_exec','private','CREATE') as policy_private_create
    `)).rows).toEqual([{ user_private_create: false, user_api_create: false, policy_private_create: false }]);
  });
});
