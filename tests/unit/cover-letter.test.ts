import { describe, expect, it } from "vitest";
import { generateCoverLetter, type CoverLetterInput } from "@/features/cover-letter/generate";

const base: CoverLetterInput = { name: "Nimal Perera", role: "Welder", organization: "Demo Steel Works", contact: "nimal@example.test", opening: "", strengths: ["MIG welding", "reading drawings", "safe work"], example: "I repaired 12 frames in one week", closing: "", tone: "formal" };
describe("cover letter template", () => {
  it("assembles only the supplied words in a formal letter", () => {
    const { text, missing } = generateCoverLetter(base);
    expect(missing).toEqual([]);
    expect(text).toContain("Dear Demo Steel Works hiring team,");
    expect(text).toContain("apply for the Welder position at Demo Steel Works.");
    expect(text).toContain("MIG welding, reading drawings and safe work");
    expect(text).toContain("For example: I repaired 12 frames in one week.");
    expect(text.endsWith("Nimal Perera\nnimal@example.test")).toBe(true);
  });
  it("uses the friendly tone, a custom opening, and never invents an example or strengths", () => {
    const friendly = generateCoverLetter({ ...base, tone: "friendly", opening: "Hi, I saw your advert.", example: "", strengths: [] });
    expect(friendly.text).toContain("Hello Demo Steel Works team,");
    expect(friendly.text).toContain("Hi, I saw your advert.");
    expect(friendly.text).not.toContain("For example");
    expect(friendly.text).not.toContain("strengths are");
    expect(friendly.missing).toEqual(["strengths"]);
  });
  it("lists what is still empty", () => {
    expect(generateCoverLetter({ ...base, name: " ", role: "", organization: "" }).missing).toEqual(["name", "role", "organization"]);
  });
});
