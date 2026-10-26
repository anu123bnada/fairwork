"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/use-i18n";
import { importEvidenceText, MAX_DOCUMENT_BYTES } from "@/features/work/document-import";
export function EvidenceDocumentImport({ capacity, disabled, append }: { capacity: number; disabled: boolean; append: (notes: string[]) => void }) {
  const { t } = useI18n();
  const [notes, setNotes] = useState<string[]>([]), [error, setError] = useState(""), [reading, setReading] = useState(false);
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; }, []);
  async function read(file: File | undefined) {
    const current = ++sequence.current; setNotes([]); setError("");
    if (!file) { setReading(false); return; }
    setReading(true);
    try {
      if (file.size > MAX_DOCUMENT_BYTES) throw new Error(t("ev.tooBig"));
      const bytes = await file.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
      const imported = importEvidenceText(file.name, file.type, new Uint8Array(bytes), digest);
      if (imported.length > capacity) throw new Error(t("ev.slots", { needed: imported.length, left: capacity }));
      if (current === sequence.current) setNotes(imported);
    } catch (caught) { if (current === sequence.current) setError(caught instanceof Error ? caught.message : t("ev.readFail")); }
    finally { if (current === sequence.current) setReading(false); }
  }
  return <section className="fw-list-card" aria-label={t("ev.aria")}>
    <h4>{t("ev.title")}</h4><p>{t("ev.intro")}</p>
    <label className="fw-field">{t("ev.file")}<input type="file" accept=".txt,text/plain" disabled={disabled || reading || capacity === 0} onChange={event => void read(event.target.files?.[0])} /></label>
    {reading && <p role="status">{t("ev.reading")}</p>}{error && <p role="alert">{error}</p>}
    {!!notes.length && <><p>{t("ev.ready", { count: notes.length })}</p><details><summary>{t("ev.preview")}</summary>{notes.map((note, index) => <pre key={index} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note}</pre>)}</details><button type="button" className="fw-secondary" disabled={disabled || notes.length > capacity} onClick={() => { append(notes); setNotes([]); }}>{t("ev.add")}</button></>}
    {(reading || notes.length > 0) && <button type="button" className="fw-secondary" onClick={() => { sequence.current++; setNotes([]); setReading(false); setError(""); }}>{t("ev.cancel")}</button>}
  </section>;
}
