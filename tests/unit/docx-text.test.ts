import { describe, expect, it } from "vitest";
import { deflateRawSync } from "node:zlib";
import { DOCX_LIMITS, DocxTextError, extractDocxText, textFromDocumentXml } from "@/features/offer/docx-text";

function zip(entries: { name: string; data: Buffer; method?: 0 | 8 }[]): Uint8Array {
  const locals: Buffer[] = [], centrals: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const method = entry.method ?? 8, body = method === 8 ? deflateRawSync(entry.data) : entry.data, name = Buffer.from(entry.name);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8); local.writeUInt32LE(body.length, 18); local.writeUInt32LE(entry.data.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(method, 10); central.writeUInt32LE(body.length, 20); central.writeUInt32LE(entry.data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, body); centrals.push(central, name); offset += 30 + name.length + body.length;
  }
  const centralBytes = Buffer.concat(centrals), eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(centralBytes.length, 12); eocd.writeUInt32LE(offset, 16);
  return new Uint8Array(Buffer.concat([...locals, centralBytes, eocd]));
}
const para = (text: string) => `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;
const doc = (body: string) => Buffer.from(`<?xml version="1.0"?><w:document xmlns:w="x"><w:body>${body}</w:body></w:document>`);

describe("Word document intake", () => {
  it("reads paragraphs, tabs and line breaks from word/document.xml and decodes entities", () => {
    const xml = `<w:document><w:body>${para("Job offer &amp; terms")}<w:p><w:pPr/><w:r><w:t>Salary</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>LKR 80,000</w:t></w:r><w:r><w:br/></w:r><w:r><w:t>per month</w:t></w:r></w:p>${para("5 &lt; 6 &#65; &#x42;")}</w:body></w:document>`;
    expect(textFromDocumentXml(xml)).toBe("Job offer & terms\nSalary\tLKR 80,000\nper month\n5 < 6 A B");
  });
  it("extracts text from a real deflate-compressed archive and from a stored entry", async () => {
    const body = doc(para("Technician") + para("Probation: 3 months, unpaid"));
    const deflated = await extractDocxText(zip([{ name: "[Content_Types].xml", data: Buffer.from("<x/>") }, { name: "word/document.xml", data: body }]));
    expect(deflated).toEqual({ text: "Technician\nProbation: 3 months, unpaid", truncated: false });
    expect((await extractDocxText(zip([{ name: "word/document.xml", data: body, method: 0 }]))).text).toContain("Probation");
  });
  it("ignores paragraph properties, drawings and other markup it does not understand", async () => {
    const result = await extractDocxText(zip([{ name: "word/document.xml", data: doc(`<w:p><w:pPr><w:jc w:val="left"/></w:pPr><w:r><w:drawing><wp:inline/></w:drawing><w:t>visible</w:t></w:r></w:p>`) }]));
    expect(result.text).toBe("visible");
  });
  it("truncates long text at the limit and says so", async () => {
    const result = await extractDocxText(zip([{ name: "word/document.xml", data: doc(para("x".repeat(DOCX_LIMITS.maxChars + 500))) }]));
    expect(result.truncated).toBe(true); expect(result.text).toHaveLength(DOCX_LIMITS.maxChars);
  });
  it("refuses legacy .doc, non-zip files, archives without a body, empty documents and oversize input, each with a typed error", async () => {
    const kind = async (bytes: Uint8Array) => (await extractDocxText(bytes).catch((error: unknown) => error)) as DocxTextError;
    const ole = new Uint8Array(64); ole.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    expect((await kind(ole)).kind).toBe("legacy");
    expect((await kind(new TextEncoder().encode("%PDF-1.7 not a document at all"))).kind).toBe("type");
    expect((await kind(zip([{ name: "other.xml", data: Buffer.from("<x/>") }]))).kind).toBe("unreadable");
    expect((await kind(zip([{ name: "word/document.xml", data: doc("") }]))).kind).toBe("no_text");
    expect((await kind(new Uint8Array(DOCX_LIMITS.maxBytes + 1))).kind).toBe("size");
  });
  it("stops a small archive that expands beyond the limit instead of trusting its declared size", async () => {
    const bomb = Buffer.from(`<w:document>${"<w:p><w:r><w:t>a</w:t></w:r></w:p>".repeat(200000)}</w:document>`);
    expect(bomb.length).toBeGreaterThan(DOCX_LIMITS.maxXmlBytes);
    const archive = zip([{ name: "word/document.xml", data: bomb }]);
    expect(archive.byteLength).toBeLessThan(DOCX_LIMITS.maxBytes);
    expect(((await extractDocxText(archive).catch((error: unknown) => error)) as DocxTextError).kind).toBe("too_large");
  });
  it("survives a corrupt archive without throwing an untyped error", async () => {
    const good = zip([{ name: "word/document.xml", data: doc(para("hello")) }]);
    const damaged = good.slice(); damaged.set([0xff, 0xff, 0xff, 0xff], 40);
    const outcome = await extractDocxText(damaged).catch((error: unknown) => error);
    expect(outcome instanceof DocxTextError || (outcome as { text?: string }).text !== undefined).toBe(true);
  });
});
