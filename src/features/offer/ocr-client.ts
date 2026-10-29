// Browser-only helpers for reading a scanned PDF: render pages to images with pdf.js, then recognise each image with the same on-device OCR
// worker the screenshot reader uses. Nothing is uploaded, saved or sent to a provider. Each page is read by its own short-lived worker.
import { PDF_LIMITS } from "./pdf-text";

export const SCAN_LIMITS = { maxPages: 5, maxPixelsWide: 1800, timeoutMs: 60000 } as const;

export class OcrError extends Error {
  constructor(readonly kind: "unavailable" | "no_text" | "timeout" | "cancelled", message: string) { super(message); }
}

export function ocrImage(image: Blob, signal?: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new OcrError("cancelled", "Reading was cancelled.")); return; }
    const worker = new Worker("/ocr/extract-worker.js");
    const finish = (action: () => void) => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); worker.terminate(); action(); };
    const onAbort = () => finish(() => reject(new OcrError("cancelled", "Reading was cancelled.")));
    const timer = setTimeout(() => finish(() => reject(new OcrError("timeout", "Reading a page timed out."))), SCAN_LIMITS.timeoutMs);
    signal?.addEventListener("abort", onAbort);
    worker.onerror = () => finish(() => reject(new OcrError("unavailable", "The on-device reader is unavailable.")));
    worker.onmessage = event => finish(() => {
      if (typeof event.data?.text === "string" && event.data.text.trim()) resolve(event.data.text.trim());
      else reject(new OcrError("no_text", "No text could be read from this page."));
    });
    worker.postMessage(image);
  });
}

type RenderablePage = { getViewport(options: { scale: number }): { width: number; height: number }; render(options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }): { promise: Promise<void> } };

// Renders up to SCAN_LIMITS.maxPages pages of a PDF to PNG images, sized so the OCR input stays bounded.
export async function renderPdfPages(bytes: Uint8Array, signal?: AbortSignal): Promise<{ images: Blob[]; pages: number }> {
  const pdfjs = await import("pdfjs-dist/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const task = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, enableXfa: false, disableFontFace: true, stopAtErrors: false });
  const doc = await task.promise as unknown as { numPages: number; getPage(n: number): Promise<RenderablePage> };
  try {
    const images: Blob[] = [];
    const count = Math.min(doc.numPages, SCAN_LIMITS.maxPages, PDF_LIMITS.maxPages);
    for (let n = 1; n <= count; n++) {
      if (signal?.aborted) throw new OcrError("cancelled", "Reading was cancelled.");
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: Math.min(3, SCAN_LIMITS.maxPixelsWide / base.width) });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new OcrError("unavailable", "The page could not be drawn.");
      context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;
      images.push(await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new OcrError("unavailable", "The page could not be converted.")), "image/png")));
    }
    return { images, pages: doc.numPages };
  } finally { await task.destroy().catch(() => {}); }
}
