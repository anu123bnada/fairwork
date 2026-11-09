import { describe, expect, it } from "vitest";
import { applicationContent, emptyApplication, emptyProject, prepItems, projectContent, recordSaveInput } from "@/features/records/schema";

const id = "40000000-0000-4000-8000-000000000001";
describe("personal records schema", () => {
  it("accepts the empty application and project and a fully filled application", () => {
    expect(applicationContent.safeParse(emptyApplication).success).toBe(true);
    expect(projectContent.safeParse(emptyProject).success).toBe(true);
    expect(emptyApplication.prep).toHaveLength(prepItems.length);
    expect(applicationContent.safeParse({ ...emptyApplication, organization: "DEMO Stores", appliedOn: "2026-11-01", nextStepAt: "2026-11-12T09:30", events: [{ id, kind: "interview", at: "2026-11-12T09:30", notes: "Phone call" }] }).success).toBe(true);
  });
  it("rejects bad dates, unknown fields and oversize lists", () => {
    expect(applicationContent.safeParse({ ...emptyApplication, appliedOn: "01/11/2026" }).success).toBe(false);
    expect(applicationContent.safeParse({ ...emptyApplication, nextStepAt: "tomorrow" }).success).toBe(false);
    expect(applicationContent.safeParse({ ...emptyApplication, salary: 1 }).success).toBe(false);
    expect(applicationContent.safeParse({ ...emptyApplication, events: Array.from({ length: 31 }, () => ({ id, kind: "note", at: "", notes: "" })) }).success).toBe(false);
    expect(projectContent.safeParse({ ...emptyProject, tasks: Array.from({ length: 51 }, () => ({ id, title: "t", done: false })) }).success).toBe(false);
    expect(projectContent.safeParse({ ...emptyProject, milestones: [{ id, title: "m", done: false, dueOn: "later" }] }).success).toBe(false);
  });
  it("ties the status list to the kind and rejects a client-supplied owner", () => {
    const application = { id, kind: "application", title: "Picker", status: "applied", content: emptyApplication, expectedRevision: 0 };
    expect(recordSaveInput.safeParse(application).success).toBe(true);
    expect(recordSaveInput.safeParse({ ...application, status: "active" }).success).toBe(false);
    expect(recordSaveInput.safeParse({ id, kind: "project", title: "P", status: "active", content: emptyProject, expectedRevision: 0 }).success).toBe(true);
    expect(recordSaveInput.safeParse({ id, kind: "project", title: "P", status: "applied", content: emptyProject, expectedRevision: 0 }).success).toBe(false);
    expect(recordSaveInput.safeParse({ ...application, ownerId: id }).success).toBe(false);
    expect(recordSaveInput.safeParse({ ...application, title: "   " }).success).toBe(false);
    expect(recordSaveInput.safeParse({ ...application, content: emptyProject }).success).toBe(false);
  });
});
