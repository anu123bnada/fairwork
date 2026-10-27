// Local, in-browser text extraction from a Word (.docx) file. Nothing is uploaded and no library is added: a .docx is a ZIP archive, so this reads the
// archive's central directory, inflates only `word/document.xml` with the platform's DecompressionStream, and takes the text of its paragraphs.
// Only the body text is read. Macros are never executed, embedded objects and images are ignored, and old binary .doc files are refused.
export const DOCX_LIMITS = { maxBytes: 5 * 1024 * 1024, maxXmlBytes: 4 * 1024 * 1024, maxChars: 10000 } as const;

export type DocxErrorKind = "type" | "size" | "legacy" | "unreadable" | "too_large" | "no_text";
export class DocxTextError extends Error {
  constructor(readonly kind: DocxErrorKind, message: string) { super(message); }
}
export type DocxTextResult = { text: string; truncated: boolean };

const u16 = (b: Uint8Array, o: number) => b[o]! | (b[o + 1]! << 8);
const u32 = (b: Uint8Array, o: number) => (b[o]! | (b[o + 1]! << 8) | (b[o + 2]! << 16) | (b[o + 3]! << 24)) >>> 0;

async function inflateRaw(data: Uint8Array, limit: number): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const reader = stream.getReader(), chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    // A small archive can claim to expand enormously; stop reading instead of trusting the declared size.
    if (total > limit) { await reader.cancel(); throw new DocxTextError("too_large", "The document is too large to read here."); }
    chunks.push(value);
  }
  const out = new Uint8Array(total); let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.byteLength; }
  return out;
}

function findEntry(bytes: Uint8Array, wanted: string): { method: number; compressed: Uint8Array; size: number } | null {
  // End of central directory record: the last 22+ bytes, signature 0x06054b50.
  let eocd = -1;
  for (let i = bytes.byteLength - 22; i >= Math.max(0, bytes.byteLength - 22 - 65535); i--) if (u32(bytes, i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) return null;
  const count = u16(bytes, eocd + 10);
  let offset = u32(bytes, eocd + 16);
  for (let n = 0; n < count && offset + 46 <= bytes.byteLength; n++) {
    if (u32(bytes, offset) !== 0x02014b50) return null;
    const method = u16(bytes, offset + 10), compressedSize = u32(bytes, offset + 20), size = u32(bytes, offset + 24);
    const nameLength = u16(bytes, offset + 28), extraLength = u16(bytes, offset + 30), commentLength = u16(bytes, offset + 32), local = u32(bytes, offset + 42);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (name === wanted) {
      if (local + 30 > bytes.byteLength || u32(bytes, local) !== 0x04034b50) return null;
      const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28);
      if (start + compressedSize > bytes.byteLength) return null;
      return { method, compressed: bytes.subarray(start, start + compressedSize), size };
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return null;
}

const entities: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const decode = (value: string) => value.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
  if (e[0] === "#") { const code = e[1] === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ""; }
  return entities[e] ?? "";
});

// Pure and exported for tests: paragraphs become lines, tabs and line breaks are kept, everything else in the XML is dropped.
export function textFromDocumentXml(xml: string): string {
  const paragraphs = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  return paragraphs.map(paragraph => {
    const parts = paragraph.match(/<w:t(?: [^>]*)?>[^<]*<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>|<w:cr\s*\/>/g) ?? [];
    return parts.map(part => part.startsWith("<w:t>") || part.startsWith("<w:t ") ? decode(part.replace(/<[^>]+>/g, "")) : part.startsWith("<w:tab") ? "\t" : "\n").join("").replace(/[ \t]+$/g, "");
  }).filter((line, index, all) => line.trim() !== "" || (index > 0 && all[index - 1]!.trim() !== "")).join("\n").trim();
}

export async function extractDocxText(bytes: Uint8Array): Promise<DocxTextResult> {
  if (bytes.byteLength > DOCX_LIMITS.maxBytes) throw new DocxTextError("size", "Choose a Word document under 5 MB.");
  // Content, not the file name, decides: legacy .doc files are OLE containers, a .docx starts with the ZIP signature.
  if (bytes.byteLength >= 8 && u32(bytes, 0) === 0xe011cfd0 && u32(bytes, 4) === 0xe11ab1a1) throw new DocxTextError("legacy", "Old .doc files are not supported. Save as .docx or paste the text.");
  if (bytes.byteLength < 22 || u32(bytes, 0) !== 0x04034b50) throw new DocxTextError("type", "That file is not a .docx document.");
  const entry = findEntry(bytes, "word/document.xml");
  if (!entry || (entry.method !== 0 && entry.method !== 8)) throw new DocxTextError("unreadable", "That document could not be read.");
  let xmlBytes: Uint8Array;
  try { xmlBytes = entry.method === 0 ? entry.compressed : await inflateRaw(entry.compressed, DOCX_LIMITS.maxXmlBytes); }
  catch (error) { if (error instanceof DocxTextError) throw error; throw new DocxTextError("unreadable", "That document could not be read."); }
  if (xmlBytes.byteLength > DOCX_LIMITS.maxXmlBytes) throw new DocxTextError("too_large", "The document is too large to read here.");
  const text = textFromDocumentXml(new TextDecoder().decode(xmlBytes));
  if (!text) throw new DocxTextError("no_text", "No text was found in that document.");
  return text.length > DOCX_LIMITS.maxChars ? { text: text.slice(0, DOCX_LIMITS.maxChars), truncated: true } : { text, truncated: false };
}
