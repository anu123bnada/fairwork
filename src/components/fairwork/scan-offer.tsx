"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { appRequest } from "@/features/authority/client";
import { ocrImage, OcrError } from "@/features/offer/ocr-client";
import { screenshotDimensions } from "@/features/offer/screenshot-validation";
import { newScanStages, updateScanStage, summarizeScan, SCAN_TEXT_LIMIT, type ScanStage, type ScanStageId, type ScanSummary } from "@/features/scan/report";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import { AiAnalysis } from "./ai-analysis";
import { ClauseFindings } from "./offer-intelligence";
import { ExtractionQualityNote } from "./extraction-quality-note";
import { RuleAnalysis } from "./rule-analysis";
import { useProduct } from "./product-app";
import "./scan-offer.css";
import { userMessage } from "@/lib/user-error";

// A single screenshot may take a while on a slow phone; the screen shows live elapsed seconds and a Cancel button, so a longer limit is honest.
const SCAN_READ_TIMEOUT_MS = 120000;
class StageError extends Error { constructor(readonly stage: ScanStageId, message: string) { super(message); } }
type Phase = "idle" | "scanning" | "failed" | "report";

// Scan an offer from a screenshot. The scanning window shows real stages only: each one changes when the work behind it finishes, and the reader runs on this device.
// The result is a report built from rules on this device; real AI is offered inside the report and runs only when the owner has configured it and the person consents.
export function ScanOfferScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { setSourceText } = useProduct();
  const [phase, setPhase] = useState<Phase>("idle");
  const [stages, setStages] = useState<ScanStage[]>(newScanStages());
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [text, setText] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [summary, setSummary] = useState<ScanSummary | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
  const [scannedAt, setScannedAt] = useState("");
  const controller = useRef<AbortController | null>(null);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrl = useRef<string | null>(null);
  const lastFile = useRef<File | null>(null);

  const stopTicker = () => { if (ticker.current) clearInterval(ticker.current); ticker.current = null; };
  const setPreviewFor = (file: File | null) => {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = file ? URL.createObjectURL(file) : null;
    setPreview(previewUrl.current);
  };
  useEffect(() => () => { controller.current?.abort(); stopTicker(); if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }, []);

  const cancel = useCallback(() => {
    controller.current?.abort();
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
    setPhase(current => current === "report" ? current : "idle");
  }, []);
  useEffect(() => {
    if (phase !== "scanning" && phase !== "failed") return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") cancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, cancel]);

  async function scan(file: File) {
    lastFile.current = file;
    controller.current?.abort();
    const mine = new AbortController(); controller.current = mine;
    setPreviewFor(file); setFileName(file.name.slice(0, 120)); setText(""); setSummary(null); setAiConfigured(null); setElapsed(0);
    setStages(newScanStages()); setPhase("scanning");
    const set = (id: ScanStageId, state: ScanStage["state"], detail = "") => { if (!mine.signal.aborted) setStages(current => updateScanStage(current, id, state, detail)); };
    try {
      // 1. the image is checked before anything is decoded
      set("image", "active");
      if (!["image/png", "image/jpeg"].includes(file.type) || file.size < 8 || file.size > 5 * 1024 * 1024) throw new StageError("image", t("scan.err.file"));
      let bitmap: ImageBitmap | null = null;
      try {
        screenshotDimensions(new Uint8Array(await file.arrayBuffer()), file.type);
        bitmap = await createImageBitmap(file);
        if (!(bitmap.width > 0 && bitmap.height > 0 && bitmap.width * bitmap.height <= 12000000)) throw new Error("size");
        set("image", "done", t("scan.d.image", { kind: file.type === "image/png" ? "PNG" : "JPEG", width: bitmap.width, height: bitmap.height, kb: Math.max(1, Math.round(file.size / 1024)) }));
      } catch { throw new StageError("image", t("scan.err.image")); } finally { bitmap?.close(); }
      if (mine.signal.aborted) return;

      // 2. on-device reading; there is no honest percentage from the reader, so the screen shows real elapsed seconds
      set("read", "active");
      const started = Date.now();
      ticker.current = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
      let raw: string;
      try { raw = await ocrImage(file, mine.signal, SCAN_READ_TIMEOUT_MS); }
      catch (caught) {
        stopTicker();
        if (caught instanceof OcrError && caught.kind === "cancelled") return;
        throw new StageError("read", caught instanceof OcrError && caught.kind === "no_text" ? t("scan.err.noText") : caught instanceof OcrError && caught.kind === "timeout" ? t("scan.err.timeout") : t("scan.err.reader"));
      }
      stopTicker();
      const cut = raw.length > SCAN_TEXT_LIMIT, readText = raw.slice(0, SCAN_TEXT_LIMIT);
      set("read", "done", t("scan.d.read", { chars: readText.length, seconds: Math.max(1, Math.round((Date.now() - started) / 1000)) }));

      // 3 and 4. quality and rules both run on this device on the text that was just read
      set("quality", "active");
      const result = summarizeScan(readText, { source: "ocr", truncated: cut });
      set("quality", "done", t(`im.q.${result.quality}` as MessageKey));
      set("rules", "active");
      const warnings = result.warningHigh + result.warningMedium + result.warningLow;
      set("rules", "done", t("scan.d.rules", { warnings, missing: result.missingDetails }));

      // 5. a real request that only asks whether AI is configured; it sends no text
      set("ai", "active");
      let configured = false;
      try { const state = await appRequest("/api/v1/offers/analyze"); configured = state?.configured === true; }
      catch { set("ai", "skipped", t("scan.d.aiUnknown")); }
      if (mine.signal.aborted) return;
      setAiConfigured(configured);
      if (configured) set("ai", "done", t("scan.d.aiReady"));
      else setStages(current => current.map(stage => stage.id === "ai" && stage.state === "active" ? { ...stage, state: "skipped", detail: t("scan.d.aiOff") } : stage));

      setText(readText); setTruncated(cut); setSummary(result); setScannedAt(new Date().toLocaleString());
      setPhase("report");
    } catch (caught) {
      stopTicker();
      if (mine.signal.aborted) return;
      const stage = caught instanceof StageError ? caught.stage : "read";
      set(stage, "failed", userMessage(caught, t("scan.err.reader")));
      setPhase("failed");
    }
  }

  const readActive = stages.find(stage => stage.id === "read")?.state === "active";
  const newScan = () => { setPhase("idle"); setText(""); setSummary(null); setPreviewFor(null); setFileName(""); };
  const continueToOffer = () => { setSourceText(text); router.push("/app/add-offer"); };
  const warnings = summary ? summary.warningHigh + summary.warningMedium + summary.warningLow : 0;

  return <section className="oq-scan" aria-label={t("scan.aria")}>
    {phase !== "report" && <div className="oq-scan-start">
      <p>{t("scan.intro")}</p>
      <p className="fw-notice">{t("scan.privacy")}</p>
      <label className="fw-field">{t("scan.file")}<input type="file" accept="image/png,image/jpeg" disabled={phase === "scanning"} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void scan(file); }} /></label>
    </div>}

    {(phase === "scanning" || phase === "failed") && <div className="oq-scan-backdrop">
      <div className="oq-scan-dialog" role="dialog" aria-modal="true" aria-labelledby="oq-scan-title">
        <h2 id="oq-scan-title">{phase === "failed" ? t("scan.failedTitle") : t("scan.scanningTitle")}</h2>
        {preview && <div className={`oq-scan-preview${readActive ? " oq-scan-reading" : ""}`}>
          <img src={preview} alt={t("scan.previewAlt")} />
          <span className="oq-scan-line" aria-hidden="true" />
        </div>}
        <ol className="oq-scan-stages" aria-live="polite" aria-label={t("scan.stagesAria")}>
          {stages.map(stage => <li key={stage.id} className={`oq-scan-stage oq-scan-${stage.state}`} data-stage={stage.id} data-state={stage.state}>
            <span className="oq-scan-dot" aria-hidden="true" />
            <span><strong>{t(`scan.stage.${stage.id}` as MessageKey)}</strong> <em>{t(`scan.state.${stage.state}` as MessageKey)}{stage.id === "read" && stage.state === "active" ? ` · ${t("scan.seconds", { seconds: elapsed })}` : ""}</em>
              {stage.detail && <small>{stage.detail}</small>}</span>
          </li>)}
        </ol>
        <div className="oq-scan-actions">
          {phase === "scanning" && <button type="button" className="fw-secondary" autoFocus onClick={cancel}>{t("scan.cancel")}</button>}
          {phase === "failed" && <>
            <button type="button" className="fw-primary" autoFocus onClick={() => lastFile.current && void scan(lastFile.current)}>{t("scan.retry")}</button>
            <button type="button" className="fw-secondary" onClick={cancel}>{t("scan.close")}</button>
          </>}
        </div>
      </div>
    </div>}

    {phase === "report" && summary && <article className="oq-scan-report" aria-label={t("scan.reportAria")}>
      <div className="oq-scan-report-head">
        <h2>{t("scan.reportTitle")}</h2>
        <p>{t("scan.reportMeta", { file: fileName, at: scannedAt })}</p>
      </div>
      <section aria-label={t("scan.summaryAria")} className="oq-scan-summary">
        <h3>{t("scan.summaryTitle")}</h3>
        <p>{t("scan.summaryText", { chars: summary.characters, warnings, high: summary.warningHigh, clauses: summary.clauseFindings, missing: summary.missingDetails })}</p>
        <p>{aiConfigured ? t("scan.aiReady") : t("scan.aiOff")}</p>
        <ul className="oq-scan-chips">{summary.termsFound.length > 0 ? summary.termsFound.map(term => <li key={term}>{term}</li>) : <li>{t("scan.noTerms")}</li>}</ul>
      </section>
      <ExtractionQualityNote text={text} source="ocr" truncated={truncated} />
      <RuleAnalysis text={text} />
      <ClauseFindings text={text} />
      <section className="fw-list-card" aria-label={t("scan.evidenceAria")}>
        <h3>{t("scan.evidenceTitle")}</h3>
        <p>{t("scan.evidenceHelp")}</p>
        <label className="fw-field">{t("scan.evidenceLabel")}<textarea value={text} maxLength={SCAN_TEXT_LIMIT} rows={10} onChange={event => { setText(event.target.value); setSummary(summarizeScan(event.target.value, { source: "ocr", truncated })); }} /></label>
      </section>
      <AiAnalysis text={text} role="WORKER" />
      <section className="fw-list-card" aria-label={t("scan.limitsAria")}>
        <h3>{t("scan.limitsTitle")}</h3>
        <p>{t("scan.limits")}</p>
      </section>
      <div className="oq-scan-actions oq-scan-noprint">
        <button type="button" className="fw-primary" onClick={continueToOffer}>{t("scan.continue")}</button>
        <button type="button" className="fw-secondary" onClick={() => window.print()}>{t("scan.print")}</button>
        <button type="button" className="fw-secondary" onClick={newScan}>{t("scan.again")}</button>
      </div>
    </article>}
  </section>;
}
