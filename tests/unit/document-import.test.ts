import { expect, it } from "vitest";
import { importEvidenceText } from "../../src/features/work/document-import";
const bytes = (text: string) => new TextEncoder().encode(text);
it("preserves document provenance and exact editable excerpts within evidence limits", () => {
  const text = "A".repeat(1699) + "🙂" + "B".repeat(1800);
  const result = importEvidenceText("notes.txt", "text/plain", bytes(text), "a".repeat(64));
  expect(result.every(note => note.length <= 2000)).toBe(true);
  expect(result.map(note => note.split("\n\n")[1]).join("")).toBe(text);
  expect(result[0]).toContain("Original SHA-256"); expect(result[0]).toContain("original file not stored");
});
it("rejects binary, oversized, invalid encoding and unsupported formats without silent truncation", () => {
  for (const [name, mime, content] of [["x.pdf", "application/pdf", bytes("PDF")], ["x.txt", "text/plain", new Uint8Array([255])], ["x.txt", "text/plain", bytes("a\0b")], ["x.txt", "text/plain", bytes("a".repeat(16001))]] as const) expect(() => importEvidenceText(name, mime, content, "a".repeat(64))).toThrow();
});
