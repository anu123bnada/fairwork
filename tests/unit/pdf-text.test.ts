import { expect, it } from "vitest";
import { extractPdfText, PdfTextError, PDF_LIMITS, type PdfLoader } from "@/features/offer/pdf-text";

function pdf(lines: string[]): Uint8Array {
  const stream = lines.length ? `BT /F1 12 Tf 20 160 Td 14 TL ${lines.map(l => `(${l}) Tj T*`).join(" ")} ET` : "";
  const text = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n` +
    `4 0 obj<</Length ${stream.length}>>stream\n${stream}\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF`;
  return new TextEncoder().encode(text);
}
// Real pdf.js parsing in Node (legacy build); the browser build is covered by the browser test.
const nodeLoader: PdfLoader = async data => {
  const lib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = lib.getDocument({ data: new Uint8Array(data), useSystemFonts: false });
  const doc = await task.promise;
  return { numPages: doc.numPages, getPage: n => doc.getPage(n) as never, destroy: () => task.destroy() };
};

it("extracts the text of a real text-based PDF", async () => {
  const result = await extractPdfText(pdf(["Salary LKR 90000 per month", "Unpaid trial 30 days"]), nodeLoader);
  expect(result.text).toContain("Salary LKR 90000 per month"); expect(result.text).toContain("Unpaid trial 30 days");
  expect(result).toMatchObject({ pages: 1, pagesRead: 1, truncated: false });
}, 30000);
it("reports a PDF with no text layer instead of returning empty text", async () => {
  await expect(extractPdfText(pdf([]), nodeLoader)).rejects.toMatchObject({ kind: "no_text" });
}, 30000);
it("decides by content and size, never by name or declared type", async () => {
  const svg = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
  await expect(extractPdfText(svg, nodeLoader)).rejects.toMatchObject({ kind: "type" });
  await expect(extractPdfText(new Uint8Array(4), nodeLoader)).rejects.toMatchObject({ kind: "type" });
  await expect(extractPdfText(new Uint8Array(PDF_LIMITS.maxBytes + 1), nodeLoader)).rejects.toMatchObject({ kind: "size" });
});
it("bounds pages and characters and maps library failures to safe messages", async () => {
  const header = new TextEncoder().encode("%PDF-1.7 fake");
  const manyPages: PdfLoader = async () => ({ numPages: 50, destroy: async () => {}, getPage: async () => ({ getTextContent: async () => ({ items: [{ str: "x".repeat(700), hasEOL: true }] }) }) });
  const big = await extractPdfText(header, manyPages);
  expect(big).toMatchObject({ pages: 50, pagesRead: PDF_LIMITS.maxPages, truncated: true }); expect(big.text.length).toBe(PDF_LIMITS.maxChars);
  const locked: PdfLoader = async () => { throw Object.assign(new Error("secret internal detail"), { name: "PasswordException" }); };
  await expect(extractPdfText(header, locked)).rejects.toMatchObject({ kind: "encrypted" });
  const broken: PdfLoader = async () => { throw new Error("C:/internal/path failed"); };
  const error = (await extractPdfText(header, broken).catch(e => e)) as PdfTextError;
  expect(error).toMatchObject({ kind: "unreadable" }); expect(error.message).not.toContain("internal");
});
