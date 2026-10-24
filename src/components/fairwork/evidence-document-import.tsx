"use client";
import { useEffect, useRef, useState } from "react";
import { importEvidenceText, MAX_DOCUMENT_BYTES } from "@/features/work/document-import";
export function EvidenceDocumentImport({ capacity, disabled, append }: { capacity: number; disabled: boolean; append: (notes: string[]) => void }) {
  const [notes, setNotes] = useState<string[]>([]), [error, setError] = useState(""), [reading, setReading] = useState(false);
  const sequence = useRef(0);
  useEffect(() => () => { sequence.current++; }, []);
  async function read(file: File | undefined) {
    const current = ++sequence.current; setNotes([]); setError("");
    if (!file) { setReading(false); return; }
    setReading(true);
    try {
      if (file.size > MAX_DOCUMENT_BYTES) throw new Error("The document must be at most 16,000 bytes.");
      const bytes = await file.arrayBuffer();
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
      const imported = importEvidenceText(file.name, file.type, new Uint8Array(bytes), digest);
      if (imported.length > capacity) throw new Error(`This document needs ${imported.length} evidence slots; ${capacity} remain. Use a shorter document or remove a statement.`);
      if (current === sequence.current) setNotes(imported);
    } catch (caught) { if (current === sequence.current) setError(caught instanceof Error ? caught.message : "Document could not be read."); }
    finally { if (current === sequence.current) setReading(false); }
  }
  return <section className="fw-list-card" aria-label="Import document evidence">
    <h4>Import text document evidence</h4><p>Read a UTF-8 .txt file locally, then review its excerpts. Nothing is sent until you save the private work draft. The original file is not uploaded or retained; imported text is not independently verified.</p>
    <label className="fw-field">Text document<input type="file" accept=".txt,text/plain" disabled={disabled || reading || capacity === 0} onChange={event => void read(event.target.files?.[0])} /></label>
    {reading && <p role="status">Reading document on this device…</p>}{error && <p role="alert">{error}</p>}
    {!!notes.length && <><p>{notes.length} editable evidence statements ready. Check for confidential information before adding.</p><details><summary>Preview imported text</summary>{notes.map((note, index) => <pre key={index} style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note}</pre>)}</details><button type="button" className="fw-secondary" disabled={disabled || notes.length > capacity} onClick={() => { append(notes); setNotes([]); }}>Add excerpts to draft</button></>}
    {(reading || notes.length > 0) && <button type="button" className="fw-secondary" onClick={() => { sequence.current++; setNotes([]); setReading(false); setError(""); }}>Cancel document import</button>}
  </section>;
}
