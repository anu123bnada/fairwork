import { describe, expect, it } from "vitest";
import { cvContent, cvSaveInput, emptyCv } from "@/features/cv/schema";

const id = "40000000-0000-4000-8000-000000000001";
describe("CV schema", () => {
  it("accepts the empty CV and a fully typed one", () => {
    expect(cvContent.safeParse(emptyCv).success).toBe(true);
    const full = { ...emptyCv, summary: "Written by the person", skills: ["Welding"], basics: { ...emptyCv.basics, fullName: "A B", links: [{ label: "Portfolio", url: "https://example.test/me" }] },
      experience: [{ employer: "E", role: "R", start: "2024", end: "2025", details: "Did work" }] };
    expect(cvContent.safeParse(full).success).toBe(true);
  });
  it("rejects links that are not https, including script and data links", () => {
    for (const url of ["http://example.test", "javascript:alert(1)", "data:text/html,x", "https://exa mple.test", "//example.test", "ftp://example.test"]) {
      expect(cvContent.safeParse({ ...emptyCv, basics: { ...emptyCv.basics, links: [{ label: "x", url }] } }).success, url).toBe(false);
      expect(cvContent.safeParse({ ...emptyCv, projects: [{ name: "p", description: "", link: url }] }).success, url).toBe(false);
    }
    expect(cvContent.safeParse({ ...emptyCv, projects: [{ name: "p", description: "", link: "" }] }).success).toBe(true);
  });
  it("is strict: no verification flags, no unknown sections, no oversize fields or lists", () => {
    expect(cvContent.safeParse({ ...emptyCv, verified: true }).success).toBe(false);
    expect(cvContent.safeParse({ ...emptyCv, experience: [{ employer: "E", role: "R", start: "", end: "", details: "", verified: true }] }).success).toBe(false);
    expect(cvContent.safeParse({ ...emptyCv, summary: "x".repeat(1001) }).success).toBe(false);
    expect(cvContent.safeParse({ ...emptyCv, skills: Array.from({ length: 31 }, (_, i) => `s${i}`) }).success).toBe(false);
    expect(cvContent.safeParse({ ...emptyCv, references: Array.from({ length: 4 }, () => ({ name: "n", relationship: "r", contact: "c" })) }).success).toBe(false);
  });
  it("requires a title, a known layout and rejects a client-supplied owner", () => {
    const base = { id, title: "CV", template: "classic", targetRole: null, content: emptyCv, expectedRevision: 0 };
    expect(cvSaveInput.safeParse(base).success).toBe(true);
    expect(cvSaveInput.safeParse({ ...base, title: "  " }).success).toBe(false);
    expect(cvSaveInput.safeParse({ ...base, template: "fancy" }).success).toBe(false);
    expect(cvSaveInput.safeParse({ ...base, ownerId: id }).success).toBe(false);
  });
});
