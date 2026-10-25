"use client";
import { useRef, useState } from "react";
import { extractPdfText, PdfTextError, PDF_LIMITS, type PdfTextResult } from "@/features/offer/pdf-text";

export function OfferPdf({ onReviewed }: { onReviewed: (text: string) => void }) {
  const [result, setResult] = useState<PdfTextResult | null>(null), [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const sequence = useRef(0);
  async function read(file: File | undefined) {
    const current = ++sequence.current; setResult(null); setText(""); setError(""); if (!file) return;
    setBusy(true);
    try {
      const value = await extractPdfText(new Uint8Array(await file.arrayBuffer()));
      if (current !== sequence.current) return; setResult(value); setText(value.text);
    } catch (caught) {
      if (current !== sequence.current) return;
      setError(caught instanceof PdfTextError ? caught.message : "This PDF could not be read. Try another file or paste the text.");
    } finally { if (current === sequence.current) setBusy(false); }
  }
  return <section className="fw-card fw-source-panel" aria-label="Local PDF reader">
    <h3>Read a text PDF on this device</h3>
    <p>Your PDF stays on this device and is not saved or uploaded. Only text-based PDFs work (up to 5 MB and {PDF_LIMITS.maxPages} pages); scanned PDFs need the Screenshot reader. Extracted text can be incomplete or out of order, so review it before continuing. This is text extraction, not AI analysis.</p>
    <label className="fw-field">Offer PDF<input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={event => { void read(event.target.files?.[0]); event.target.value = ""; }} /></label>
    {busy && <p role="status">Reading on this device…</p>}
    {error && <p role="alert">{error}</p>}
    {result && <>
      <p role="status">Read {result.pagesRead} of {result.pages} page{result.pages === 1 ? "" : "s"}.{result.truncated ? ` Only the first ${PDF_LIMITS.maxChars.toLocaleString()} characters and ${PDF_LIMITS.maxPages} pages are kept.` : ""}</p>
      <label className="fw-field">Review extracted text<textarea value={text} maxLength={PDF_LIMITS.maxChars} onChange={event => setText(event.target.value)} /></label>
      <p>Remove personal details you do not need. Continuing fills the text draft only; saving terms and any optional AI consent are separate actions.</p>
      <button type="button" className="fw-primary" disabled={!text.trim()} onClick={() => onReviewed(text)}>Use this text</button>
    </>}
  </section>;
}
