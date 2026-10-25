// Local, in-browser text extraction from a text-based PDF. Nothing is uploaded.
// Scanned (image-only) PDFs have no text layer and are reported as such; the screenshot
// reader (OCR) is the supported route for those.
export const PDF_LIMITS = { maxBytes: 5 * 1024 * 1024, maxPages: 20, maxChars: 10000 } as const;

export class PdfTextError extends Error {
  constructor(readonly kind: "type" | "size" | "encrypted" | "unreadable" | "no_text", message: string) { super(message); }
}
export type PdfTextResult = { text: string; pages: number; pagesRead: number; truncated: boolean };

type TextItem = { str?: string; hasEOL?: boolean };
type Doc = { numPages: number; getPage(n: number): Promise<{ getTextContent(): Promise<{ items: TextItem[] }> }>; destroy(): Promise<void> };
export type PdfLoader = (data: Uint8Array) => Promise<Doc>;

// pdf.js is loaded on demand so it never weighs on pages that do not use PDFs.
export async function browserPdfLoader(data: Uint8Array): Promise<Doc> {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data, isEvalSupported: false, enableXfa: false, disableFontFace: true, stopAtErrors: false });
  const doc = await task.promise as { numPages: number; getPage: Doc["getPage"] };
  return { numPages: doc.numPages, getPage: n => doc.getPage(n), destroy: () => task.destroy() };
}

export async function extractPdfText(bytes: Uint8Array, loader: PdfLoader = browserPdfLoader): Promise<PdfTextResult> {
  if (bytes.byteLength > PDF_LIMITS.maxBytes) throw new PdfTextError("size", "Choose a PDF under 5 MB.");
  // Content, not the file name or declared type, decides whether this is a PDF.
  if (bytes.byteLength < 8 || String.fromCharCode(...bytes.subarray(0, 5)) !== "%PDF-") throw new PdfTextError("type", "That file is not a PDF. Choose a text-based PDF.");
  let doc: Doc;
  try { doc = await loader(bytes); }
  catch (error) {
    if (error instanceof Error && error.name === "PasswordException") throw new PdfTextError("encrypted", "This PDF is password protected. Remove the password, then try again.");
    throw new PdfTextError("unreadable", "This PDF could not be read. Try another file or paste the text.");
  }
  try {
    const pagesRead = Math.min(doc.numPages, PDF_LIMITS.maxPages);
    const parts: string[] = [];
    for (let n = 1; n <= pagesRead; n++) {
      const content = await (await doc.getPage(n)).getTextContent();
      parts.push(content.items.map(item => (item.str ?? "") + (item.hasEOL ? "\n" : " ")).join("").replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim());
    }
    const joined = parts.filter(Boolean).join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
    if (!joined) throw new PdfTextError("no_text", "This PDF has no readable text (it may be a scan). Use the Screenshot reader or paste the text.");
    const truncated = doc.numPages > PDF_LIMITS.maxPages || joined.length > PDF_LIMITS.maxChars;
    return { text: joined.slice(0, PDF_LIMITS.maxChars), pages: doc.numPages, pagesRead, truncated };
  } finally { await doc.destroy().catch(() => {}); }
}
