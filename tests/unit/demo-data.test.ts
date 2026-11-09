import { describe, expect, it } from "vitest";
import { DEMO_MARK, sampleRecordBodies } from "@/features/demo/sample-records";
import { sampleEmployers } from "@/features/employers/sample-data";
import { recordSaveInput } from "@/features/records/schema";

describe("demo data", () => {
  it("builds valid, marked, unverified sample records of every kind with unique ids", () => {
    const bodies = sampleRecordBodies();
    expect(bodies).toHaveLength(7);
    expect(new Set(bodies.map(body => body.id)).size).toBe(7);
    for (const body of bodies) {
      expect(body.title.endsWith(DEMO_MARK), body.title).toBe(true);
      expect(body.expectedRevision).toBe(0);
      expect(recordSaveInput.safeParse(body).success, body.title).toBe(true);
    }
    expect(new Set(bodies.map(body => body.kind))).toEqual(new Set(["application", "project", "cover_letter", "portfolio", "roadmap"]));
    const interviews = bodies.flatMap(body => (body.kind === "application" ? body.content.events.filter(event => event.kind === "interview") : []));
    expect(interviews).toHaveLength(2);
    expect(interviews.map(event => event.status).sort()).toEqual(["completed", "scheduled"]);
  });
  it("labels every sample employer as SAMPLE and contains no verification claim", () => {
    expect(sampleEmployers.length).toBeGreaterThanOrEqual(4);
    for (const employer of sampleEmployers) {
      expect(employer.name, employer.id).toContain("(SAMPLE)");
      expect(JSON.stringify(employer), employer.id).not.toMatch(/verified|certified|accredited|guarantee/i);
    }
    expect(new Set(sampleEmployers.map(employer => employer.id)).size).toBe(sampleEmployers.length);
  });
});
