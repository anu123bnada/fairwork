"use client";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/use-i18n";
import { extractPdfText, PdfTextError, PDF_LIMITS, type PdfTextResult } from "@/features/offer/pdf-text";

export function OfferPdf({ onReviewed }: { onReviewed: (text: string) => void }) {
  const { t } = useI18n();
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
      setError(caught instanceof PdfTextError ? caught.message : t("im.pdf.failed"));
    } finally { if (current === sequence.current) setBusy(false); }
  }
  return <section className="fw-card fw-source-panel" aria-label={t("im.pdf.aria")}>
    <h3>{t("im.pdf.title")}</h3>
    <p>{t("im.pdf.intro", { pages: PDF_LIMITS.maxPages })}</p>
    <label className="fw-field">{t("im.pdf.file")}<input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={event => { void read(event.target.files?.[0]); event.target.value = ""; }} /></label>
    {busy && <p role="status">{t("im.reading")}</p>}
    {error && <p role="alert">{error}</p>}
    {result && <>
      <p role="status">{t(result.pages === 1 ? "im.pdf.readOne" : "im.pdf.readLine", { read: result.pagesRead, total: result.pages })}{result.truncated ? ` ${t("im.pdf.truncated", { chars: PDF_LIMITS.maxChars.toLocaleString(), pages: PDF_LIMITS.maxPages })}` : ""}</p>
      <label className="fw-field">{t("im.review")}<textarea value={text} maxLength={PDF_LIMITS.maxChars} onChange={event => setText(event.target.value)} /></label>
      <p>{t("im.removePersonal")}</p>
      <button type="button" className="fw-primary" disabled={!text.trim()} onClick={() => onReviewed(text)}>{t("im.pdf.use")}</button>
    </>}
  </section>;
}
