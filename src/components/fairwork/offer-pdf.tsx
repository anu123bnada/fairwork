"use client";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/use-i18n";
import { extractPdfText, PdfTextError, PDF_LIMITS, type PdfTextResult } from "@/features/offer/pdf-text";
import { OcrError, ocrImage, renderPdfPages, SCAN_LIMITS } from "@/features/offer/ocr-client";
import { ExtractionQualityNote } from "./extraction-quality-note";

export function OfferPdf({ onReviewed }: { onReviewed: (text: string) => void }) {
  const { t } = useI18n();
  const [result, setResult] = useState<PdfTextResult | null>(null), [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [scanned, setScanned] = useState<{ pages: number; read: number } | null>(null), [offerScan, setOfferScan] = useState(false), [progress, setProgress] = useState(""), [scanning, setScanning] = useState(false);
  const sequence = useRef(0), bytes = useRef<Uint8Array | null>(null), abort = useRef<AbortController | null>(null);
  function reset() { abort.current?.abort(); abort.current = null; setResult(null); setText(""); setError(""); setScanned(null); setOfferScan(false); setProgress(""); }
  async function read(file: File | undefined) {
    const current = ++sequence.current; reset(); bytes.current = null; if (!file) return;
    setBusy(true);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      bytes.current = data.slice(); // pdf.js takes ownership of the buffer it reads, so keep a copy for the scanned-page fallback
      const value = await extractPdfText(data);
      if (current !== sequence.current) return; setResult(value); setText(value.text);
    } catch (caught) {
      if (current !== sequence.current) return;
      if (caught instanceof PdfTextError && caught.kind === "no_text") setOfferScan(true);
      setError(caught instanceof PdfTextError ? caught.message : t("im.pdf.failed"));
    } finally { if (current === sequence.current) setBusy(false); }
  }
  // Explicit, on-device OCR of the pages as images. Slow and less exact than a text layer, so it is offered only after a no-text result and the person reviews the output.
  async function scan() {
    const data = bytes.current; if (!data) return;
    const current = ++sequence.current, controller = new AbortController(); abort.current = controller;
    setBusy(true); setScanning(true); setError(""); setOfferScan(false); setProgress(t("im.pdf.scanRender"));
    try {
      const { images, pages } = await renderPdfPages(data, controller.signal);
      const parts: string[] = [];
      for (let index = 0; index < images.length; index++) {
        if (current !== sequence.current) return;
        setProgress(t("im.pdf.scanProgress", { page: index + 1, total: images.length }));
        try { parts.push(await ocrImage(images[index]!, controller.signal)); }
        catch (caught) { if (caught instanceof OcrError && caught.kind === "cancelled") throw caught; parts.push(""); }
      }
      if (current !== sequence.current) return;
      if (!parts.some(Boolean)) throw new OcrError("no_text", "none");
      const marked = parts.map((part, index) => part ? (images.length > 1 ? `[Page ${index + 1}]\n${part}` : part) : "").filter(Boolean).join("\n\n").slice(0, PDF_LIMITS.maxChars);
      setText(marked); setScanned({ pages, read: images.length });
    } catch (caught) {
      if (current !== sequence.current) return;
      setError(caught instanceof OcrError && caught.kind === "cancelled" ? t("im.pdf.scanCancelled") : t("im.pdf.scanFailed"));
    } finally { if (current === sequence.current) { setBusy(false); setScanning(false); setProgress(""); abort.current = null; } }
  }
  return <section className="fw-card fw-source-panel" aria-label={t("im.pdf.aria")}>
    <h3>{t("im.pdf.title")}</h3>
    <p>{t("im.pdf.intro", { pages: PDF_LIMITS.maxPages })}</p>
    <label className="fw-field">{t("im.pdf.file")}<input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={event => { void read(event.target.files?.[0]); event.target.value = ""; }} /></label>
    {busy && <p role="status">{progress || t("im.reading")}</p>}
    {busy && scanning && <button type="button" className="fw-secondary" onClick={() => abort.current?.abort()}>{t("im.shot.cancel")}</button>}
    {error && <p role="alert">{error}</p>}
    {offerScan && !busy && <><p>{t("im.pdf.scanOffer", { pages: SCAN_LIMITS.maxPages })}</p><button type="button" className="fw-secondary" onClick={() => void scan()}>{t("im.pdf.scanButton")}</button></>}
    {(result || scanned) && <>
      {result && !scanned && <p role="status">{t(result.pages === 1 ? "im.pdf.readOne" : "im.pdf.readLine", { read: result.pagesRead, total: result.pages })}{result.truncated ? ` ${t("im.pdf.truncated", { chars: PDF_LIMITS.maxChars.toLocaleString(), pages: PDF_LIMITS.maxPages })}` : ""}</p>}
      {scanned && <p role="status">{t("im.pdf.scanDone", { read: scanned.read, total: scanned.pages })}</p>}
      <ExtractionQualityNote text={text} source={scanned ? "ocr" : "pdf"} truncated={result?.truncated} />
      <label className="fw-field">{t("im.review")}<textarea value={text} maxLength={PDF_LIMITS.maxChars} onChange={event => setText(event.target.value)} /></label>
      <p>{t("im.removePersonal")}</p>
      <button type="button" className="fw-primary" disabled={!text.trim()} onClick={() => onReviewed(text)}>{t("im.pdf.use")}</button>
    </>}
  </section>;
}
