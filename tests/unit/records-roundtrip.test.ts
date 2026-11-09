import { describe, expect, it } from "vitest";
import { applicationContent, recordDocument, recordSaveInput } from "@/features/records/schema";

// Regression for the hosted test 18 failure ("The application did not read back as saved"): the server normalizes interview events (new optional fields get defaults) when it validates a
// save, so what is stored and read back is the NORMALIZED document. A client that posts an older-shaped event must expect the defaults, and normalization must be stable.
const id = "40000000-0000-4000-8000-0000000000aa";
const legacy = { listingId: null, organization: "Synthetic Employer (DEMO)", location: "Kandy", appliedOn: "2026-11-01", nextStepAt: "2026-11-12T09:30", notes: "Synthetic note", events: [{ id, kind: "interview", at: "2026-11-12T09:30", notes: "Phone call" }], prep: [true, false, true, false, false, false] };

describe("application read-back", () => {
  it("normalizes a legacy-shaped event with defaults, so a naive exact comparison with the posted body differs (the failure)", () => {
    const saved = recordSaveInput.parse({ id, kind: "application", title: "T", status: "interviewing", content: legacy, expectedRevision: 0 });
    expect(JSON.stringify(saved.content)).not.toBe(JSON.stringify(legacy));
    const event = (saved.content as { events: Record<string, unknown>[] }).events[0]!;
    expect(event).toMatchObject({ stage: "other", status: "scheduled", outcome: "pending", questions: "", feedback: "" });
  });
  it("is stable: normalizing twice equals once, and a fully shaped event reads back exactly as posted", () => {
    const once = applicationContent.parse(legacy);
    expect(JSON.stringify(applicationContent.parse(once))).toBe(JSON.stringify(once));
    const full = { ...legacy, events: [{ ...legacy.events[0]!, stage: "other", status: "scheduled", outcome: "pending", questions: "", feedback: "" }] };
    expect(JSON.stringify(applicationContent.parse(full))).toBe(JSON.stringify(full));
  });
  it("the document returned by the read path is the normalized content with the same status and key order", () => {
    const stored = applicationContent.parse(legacy);
    const doc = recordDocument.parse({ id, kind: "application", title: "T", status: "interviewing", content: JSON.parse(JSON.stringify(stored)), revision: 1, updatedAt: "2026-11-10T00:00:00Z" });
    expect(JSON.stringify(doc.content)).toBe(JSON.stringify(stored));
    expect(doc.status).toBe("interviewing");
  });
});
