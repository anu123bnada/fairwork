"use client";
import { useRef, useState } from "react";
import { useI18n } from "@/i18n/use-i18n";
import { extractDocxText, DocxTextError, DOCX_LIMITS, type DocxTextResult } from "@/features/offer/docx-text";
import type { MessageKey } from "@/i18n";

// Reads a Word (.docx) offer on this device. The file is never uploaded or saved; the person reviews and edits the text before it is used.
export function OfferDocx({ onReviewed }: { onReviewed: (text: string) => void }) {
  const { t } = useI18n();
  const [result, setResult] = useState<DocxTextResult | null>(null), [text, setText] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const sequence = useRef(0);
  async function read(file: File | undefined) {
    const current = ++sequence.current; setResult(null); setText(""); setError(""); if (!file) return;
    setBusy(true);
    try {
      const value = await extractDocxText(new Uint8Array(await file.arrayBuffer()));
      if (current !== sequence.current) return; setResult(value); setText(value.text);
    } catch (caught) {
      if (current !== sequence.current) return;
      setError(t(`im.docx.e.${caught instanceof DocxTextError ? caught.kind : "unreadable"}` as MessageKey));
    } finally { if (current === sequence.current) setBusy(false); }
  }
  return <section className="fw-card fw-source-panel" aria-label={t("im.docx.aria")}>
    <h3>{t("im.docx.title")}</h3>
    <p>{t("im.docx.intro")}</p>
    <label className="fw-field">{t("im.docx.file")}<input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={busy} onChange={event => { void read(event.target.files?.[0]); event.target.value = ""; }} /></label>
    {busy && <p role="status">{t("im.reading")}</p>}
    {error && <p role="alert">{error}</p>}
    {result && <>
      {result.truncated && <p role="status">{t("im.docx.truncated", { chars: DOCX_LIMITS.maxChars.toLocaleString() })}</p>}
      <label className="fw-field">{t("im.review")}<textarea value={text} maxLength={DOCX_LIMITS.maxChars} onChange={event => setText(event.target.value)} /></label>
      <p>{t("im.removePersonal")}</p>
      <button type="button" className="fw-primary" disabled={!text.trim()} onClick={() => onReviewed(text)}>{t("im.pdf.use")}</button>
    </>}
  </section>;
}
