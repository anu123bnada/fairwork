import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";

// Full migration chain on PGlite. Proves applicant management is cross-tenant safe: only the author of a listing (with active company authority) sees its applicants and sets a review
// status; applicants see only their own applications; the employer side receives only the display name and the message; nothing is executable anonymously.
const db = new PGlite();
const operator = randomUUID(), repA = randomUUID(), repB = randomUUID(), alice = randomUUID(), bob = randomUUID(), other = randomUUID();
let companyA: string, companyB: string;
const listingA = randomUUID(), listingB = randomUUID();
const fields = { title: "Synthetic warehouse role", description: "Synthetic fixture only, not a real vacancy.", location: "Colombo", workMode: "onsite", salary: 50000, currency: "LKR", payPeriod: "month" };
async function rpc<T = Record<string, unknown>>(name: string, request: unknown, actor: string) {
  await db.exec("begin; set local role authenticated");
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: actor, role: "authenticated", aal: "aal2", is_anonymous: false })]);
    const result = await db.query<{ data: T }>(`select api.${name}($1::jsonb) data`, [JSON.stringify(request)]);
    await db.exec("commit"); return result.rows[0]!.data;
  } catch (error) { await db.exec("rollback"); throw error; }
}
const approve = (company: string, subject: string) => rpc("decide_membership", { companyId: company, subjectId: subject, decision: "approve", expectedRevision: 0, expiresAt: new Date(Date.now() + 86400000).toISOString(), reviewedEvidenceRefs: ["demo:fixture/applications"], reason: "Synthetic rehearsal", policyVersion: "demo-authority.v1", idempotencyKey: randomUUID() }, operator);
const publish = (id: string, company: string, actor: string) => rpc("opportunity_command", { operation: "listing", id, companyId: company, fields, status: "published", expectedVersion: 0, expiresAt: new Date(Date.now() + 86400000).toISOString(), idempotencyKey: randomUUID() }, actor);
type Inbox = { items: { id: string; applicantName: string; message: string; status: string; revision: number; [key: string]: unknown }[] };
const applicationAlice = randomUUID();

beforeAll(async () => {
  await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;");
  for (const file of (await readdir("supabase/migrations")).sort()) await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  for (const [id, label] of [[operator, "Operator"], [repA, "Rep A"], [repB, "Rep B"], [alice, "Alice Applicant"], [bob, "Bob Applicant"], [other, "Other"]] as const) {
    await db.query("insert into auth.users values($1)", [id]);
    await db.query("insert into private.profiles(id,display_name) values($1,$2)", [id, label]);
  }
  await db.query("insert into private.capability_assignments(subject_id,capability,granted_by,purpose,expires_at) values($1,'authority_operator',$2,'Synthetic test only',now()+interval '1 day')", [operator, other]);
  companyA = ((await rpc("provision_company", { name: "Synthetic company A", idempotencyKey: randomUUID() }, operator)) as { id: string }).id;
  companyB = ((await rpc("provision_company", { name: "Synthetic company B", idempotencyKey: randomUUID() }, operator)) as { id: string }).id;
  await approve(companyA, repA); await approve(companyB, repB);
  await publish(listingA, companyA, repA); await publish(listingB, companyB, repB);
}, 180000);
afterAll(async () => { await db.close(); });

describe("applicant management", () => {
  it("lets a person apply to a published listing and shares only their display name and message", async () => {
    expect(await rpc("application_submit", { id: applicationAlice, listingId: listingA, message: "I have two years of warehouse experience." }, alice)).toEqual({ id: applicationAlice, revision: 1 });
    const inbox = await rpc<Inbox>("application_inbox", { listingId: listingA }, repA);
    expect(inbox.items).toHaveLength(1);
    expect(inbox.items[0]).toMatchObject({ applicantName: "Alice Applicant", message: "I have two years of warehouse experience.", status: "submitted", revision: 1 });
    expect(Object.keys(inbox.items[0]!).sort()).toEqual(["applicantName", "createdAt", "id", "message", "revision", "status"]);
  });
  it("refuses a duplicate, an unknown or unpublished listing, a self-application, extra fields and an oversize message", async () => {
    await expect(rpc("application_submit", { id: randomUUID(), listingId: listingA, message: "again" }, alice)).rejects.toThrow(/VALIDATION_FAILED/);
    await expect(rpc("application_submit", { id: randomUUID(), listingId: randomUUID(), message: "x" }, alice)).rejects.toThrow(/NOT_FOUND/);
    await expect(rpc("application_submit", { id: randomUUID(), listingId: listingA, message: "x", applicantId: bob }, bob)).rejects.toThrow(/VALIDATION_FAILED/);
    await expect(rpc("application_submit", { id: randomUUID(), listingId: listingA, message: "x".repeat(1001) }, bob)).rejects.toThrow(/VALIDATION_FAILED/);
    await expect(rpc("application_submit", { id: randomUUID(), listingId: listingA, message: "mine" }, repA)).rejects.toThrow(/VALIDATION_FAILED/);
  });
  it("shows the applicant only their own applications", async () => {
    const mine = await rpc<{ items: { id: string; listingTitle: string; status: string }[] }>("application_mine", {}, alice);
    expect(mine.items.map(item => item.id)).toEqual([applicationAlice]);
    expect(mine.items[0]!.listingTitle).toBe("Synthetic warehouse role");
    expect((await rpc<{ items: unknown[] }>("application_mine", {}, bob)).items).toEqual([]);
  });
  it("keeps applicants out of reach of everyone except the listing author", async () => {
    await expect(rpc("application_inbox", { listingId: listingA }, repB)).rejects.toThrow(/NOT_FOUND/);
    await expect(rpc("application_inbox", { listingId: listingA }, alice)).rejects.toThrow(/NOT_FOUND/);
    await expect(rpc("application_review", { id: applicationAlice, status: "shortlisted", expectedRevision: 1 }, repB)).rejects.toThrow(/NOT_FOUND/);
    await expect(rpc("application_review", { id: applicationAlice, status: "shortlisted", expectedRevision: 1 }, alice)).rejects.toThrow(/NOT_FOUND/);
    await expect(rpc("application_withdraw", { id: applicationAlice, expectedRevision: 1 }, bob)).rejects.toThrow(/NOT_FOUND/);
    expect((await rpc<{ items: { counts: Record<string, number> }[] }>("application_dashboard", {}, repB)).items.every(item => Object.values(item.counts).every(value => value === 0))).toBe(true);
  });
  it("lets the author review with the current revision only, and only to review statuses", async () => {
    expect(await rpc("application_review", { id: applicationAlice, status: "reviewing", expectedRevision: 1 }, repA)).toEqual({ id: applicationAlice, revision: 2, status: "reviewing" });
    await expect(rpc("application_review", { id: applicationAlice, status: "shortlisted", expectedRevision: 1 }, repA)).rejects.toThrow(/VERSION_CONFLICT/);
    await expect(rpc("application_review", { id: applicationAlice, status: "withdrawn", expectedRevision: 2 }, repA)).rejects.toThrow(/VALIDATION_FAILED/);
    await expect(rpc("application_review", { id: applicationAlice, status: "submitted", expectedRevision: 2 }, repA)).rejects.toThrow(/VALIDATION_FAILED/);
    await rpc("application_review", { id: applicationAlice, status: "shortlisted", expectedRevision: 2 }, repA);
    const dashboard = await rpc<{ items: { listingId: string; counts: Record<string, number> }[] }>("application_dashboard", {}, repA);
    expect(dashboard.items.find(item => item.listingId === listingA)!.counts).toMatchObject({ shortlisted: 1, submitted: 0 });
    expect((await rpc<{ items: { status: string }[] }>("application_mine", {}, alice)).items[0]!.status).toBe("shortlisted");
  });
  it("lets the applicant withdraw, after which the author cannot change the status", async () => {
    await expect(rpc("application_withdraw", { id: applicationAlice, expectedRevision: 1 }, alice)).rejects.toThrow(/VERSION_CONFLICT/);
    await rpc("application_withdraw", { id: applicationAlice, expectedRevision: 3 }, alice);
    await expect(rpc("application_withdraw", { id: applicationAlice, expectedRevision: 4 }, alice)).rejects.toThrow(/VALIDATION_FAILED/);
    await expect(rpc("application_review", { id: applicationAlice, status: "declined", expectedRevision: 4 }, repA)).rejects.toThrow(/VALIDATION_FAILED/);
    expect((await rpc<Inbox>("application_inbox", { listingId: listingA }, repA)).items[0]!.status).toBe("withdrawn");
  });
  it("is not executable anonymously and the table has no direct access", async () => {
    for (const name of ["application_submit", "application_mine", "application_inbox", "application_review", "application_withdraw", "application_dashboard"]) {
      await db.exec("begin;set local role anon");
      try { await expect(db.query(`select api.${name}('{}'::jsonb)`)).rejects.toThrow(/permission denied/i); } finally { await db.exec("rollback"); }
    }
    await db.exec("begin;set local role authenticated");
    try { await expect(db.query("select * from private.listing_applications")).rejects.toThrow(/permission denied/i); } finally { await db.exec("rollback"); }
  });
});
