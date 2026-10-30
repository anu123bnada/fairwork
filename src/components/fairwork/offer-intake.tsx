"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, FileText, FileType, Image as ImageIcon, PenLine } from "lucide-react";
import { appRequest } from "@/features/authority/client";
import { extractOfferTermsRuleBased } from "@/features/offer/deterministic-extractor";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";
import { AiAnalysis } from "./ai-analysis";
import { OfferCompanySelector } from "./offer-company-selector";
import { OfferDocx } from "./offer-docx";
import { OfferDrafts } from "./offer-drafts";
import { OfferPdf } from "./offer-pdf";
import { OfferScreenshot } from "./offer-screenshot";
import { AssessmentDetails, DraftOfferAssessment } from "./offer-assessment";
import { assessOfferTerms, type assessmentSchema } from "@/features/offer/assessment";
import { draftReceipt } from "@/features/offer/draft-schema";
import type { z } from "zod";
import { RuleAnalysis } from "./rule-analysis";
import { ClauseFindings, QualificationPanel } from "./offer-intelligence";
import { ErrorMessage, Icon, routeFor, useProduct, type OfferResult, type Role } from "./product-app";
import "./offer-intake.css";

type Method = "paste" | "screenshot" | "pdf" | "word" | "manual";
const METHODS: Array<{ id: Method; label: MessageKey; hint: MessageKey; icon: ReactNode }> = [
  { id: "paste", label: "add.tabPaste", hint: "add.hint.paste", icon: <ClipboardPaste size={18} aria-hidden="true" /> },
  { id: "screenshot", label: "add.tabScreenshot", hint: "add.hint.screenshot", icon: <ImageIcon size={18} aria-hidden="true" /> },
  { id: "pdf", label: "add.tabPdf", hint: "add.hint.pdf", icon: <FileText size={18} aria-hidden="true" /> },
  { id: "word", label: "add.tabWord", hint: "add.hint.word", icon: <FileType size={18} aria-hidden="true" /> },
  { id: "manual", label: "add.tabManual", hint: "add.hint.manual", icon: <PenLine size={18} aria-hidden="true" /> },
];

// Field names are the persisted term names; the offer API contract is unchanged.
type FieldSpec = { name: string; kind: "text" | "number" | "area"; label: MessageKey; optional?: MessageKey };
const core = (name: string, label: MessageKey, kind: FieldSpec["kind"] = "text"): FieldSpec => ({ name, kind, label });
const extra = (name: string, optional: MessageKey): FieldSpec => ({ name, kind: "area", label: "add.optional", optional });
const GROUPS: Array<{ id: string; title: MessageKey; fields: FieldSpec[] }> = [
  { id: "job", title: "add.group.job", fields: [core("role", "add.f.role"), extra("employerName", "add.o.employerName"), extra("employmentType", "add.o.employmentType"), core("responsibilities", "add.f.responsibilities", "area")] },
  { id: "pay", title: "add.group.pay", fields: [core("salary", "add.f.salary", "number"), core("currency", "add.f.currency"), extra("payPeriod", "add.o.payPeriod"), extra("taxBasis", "add.o.taxBasis"), core("paymentDate", "add.f.paymentDate"), extra("benefits", "add.o.benefits"), extra("deductions", "add.o.deductions")] },
  { id: "hours", title: "add.group.hours", fields: [core("startDate", "add.f.startDate"), core("hoursPerWeek", "add.f.hours", "number"), extra("schedule", "add.o.schedule"), core("overtime", "add.f.overtime"), core("location", "add.f.location")] },
  { id: "leave", title: "add.group.leave", fields: [extra("leave", "add.o.leave"), extra("probation", "add.o.probation"), core("safety", "add.f.safety")] },
  { id: "contract", title: "add.group.contract", fields: [extra("contractDuration", "add.o.contractDuration"), extra("notice", "add.o.notice"), extra("contractConditions", "add.o.contractConditions")] },
  { id: "optional", title: "add.group.optional", fields: [extra("trainingDeposit", "add.o.trainingDeposit"), extra("documentRetention", "add.o.documentRetention")] },
];
const FIELD_NAMES = GROUPS.flatMap(group => group.fields.map(field => field.name)).filter(name => name !== "role");
const KEY_TERMS = ["salary", "currency", "startDate", "hoursPerWeek", "responsibilities"] as const;

export function AddOfferScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { profile, offer, setOffer, terms, setTerms, companyId, setCompanyId, workerId, setWorkerId, role, setRole, sourceText, setSourceText, ensureOfferId, startSeparateOffer } = useProduct();
  const [method, setMethod] = useState<Method>("paste");
  const [extraction, setExtraction] = useState<{ text: string; filled: number; preserved: number } | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const requestKeys = useRef(new Map<string, string>());
  // A worker without a linked organization still gets the real rule-based analysis, saved as a private draft.
  const [privateResult, setPrivateResult] = useState<{ assessment: z.infer<typeof assessmentSchema>; revision: number } | null>(null);
  const privateDraft = useRef<{ id: string; revision: number } | null>(null);

  useEffect(() => {
    if (role === "WORKER" && profile?.id && !workerId) setWorkerId(profile.id);
  }, [profile?.id, workerId, role, setWorkerId]);

  const updateTerm = (field: string, value: string) => setTerms({ ...terms, [field]: value });
  const keyTermsDone = KEY_TERMS.filter(field => Boolean(terms[field]?.trim())).length;
  // Text read from a file or image moves into the editable paste box; nothing is applied to the fields until the person asks for suggestions.
  const applyReadText = (text: string) => { setSourceText(text); setReviewed(true); setMethod("paste"); };

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formElement = event.currentTarget;
    const privatePath = role === "WORKER" && !offer && !companyId;
    const invalid = Array.from(formElement.elements).find(element =>
      !(privatePath && (element as HTMLElement & { name?: string }).name === "companyId") &&
      (element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement) && !element.validity.valid,
    ) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | undefined;
    if (invalid) {
      const label = invalid.labels?.[0]?.textContent?.trim() ?? "Offer field";
      setError(new Error(invalid.name === "companyId" ? "Select a linked organization before saving. If none are available, use the participant-link or organization-approval steps below." : `${label}: ${invalid.validationMessage}`));
      invalid.focus();
      return;
    }
    const form = new FormData(event.currentTarget);
    if (!String(form.get("role") ?? "").trim()) {
      setError(new Error("Enter a role title. Pasted text must be reviewed in the offer fields before saving."));
      formElement.querySelector<HTMLInputElement>('[name="role"]')?.focus();
      return;
    }
    setBusy(true);
    const normalizedTerms: Record<string, string | number> = {
      // Keep persisted extension fields that this editor does not render.
      // A rendered field is removed only when the user explicitly clears it.
      ...(offer?.snapshot ?? {}),
      role: String(form.get("role") ?? "").trim(),
    };
    // Omit unknown terms so the database can generate its missing-field questions.
    // Supplied numeric values still pass native and strict API validation.
    for (const field of FIELD_NAMES) {
      const value = String(form.get(field) ?? "").trim();
      if (value) normalizedTerms[field] = field === "salary" || field === "hoursPerWeek" ? Number(value) : value;
      else delete normalizedTerms[field];
    }
    if (privatePath) {
      try {
        const assessment = assessOfferTerms(normalizedTerms);
        const lines = Object.entries(normalizedTerms).map(([name, value]) => `${name}: ${value}`).join(String.fromCharCode(10));
        const text = (sourceText.trim() ? [sourceText.trim(), "--- Reviewed terms ---", lines].join(String.fromCharCode(10, 10)) : lines).slice(0, 10000);
        const current = privateDraft.current ?? { id: crypto.randomUUID(), revision: 0 };
        const receipt = draftReceipt.parse(await appRequest("/api/v1/offers/drafts", {
          operation: "save", id: current.id, expectedRevision: current.revision, idempotencyKey: crypto.randomUUID(),
          content: { role: String(normalizedTerms.role).slice(0, 120), employer: String(normalizedTerms.employerName ?? "").slice(0, 200), text },
        }));
        privateDraft.current = { id: receipt.id, revision: receipt.revision };
        setPrivateResult({ assessment, revision: receipt.revision });
      } catch (caught) {
        setPrivateResult(null);
        setError(caught instanceof Error ? caught : new Error("The private draft could not be saved."));
      } finally { setBusy(false); }
      return;
    }
    const requestBody = {
      offerId: offer?.offerId ?? ensureOfferId(),
      companyId: String(form.get("companyId") ?? "").trim(),
      workerId: String(form.get("workerId") ?? "").trim(),
      requesterRole: role,
      terms: normalizedTerms,
      expectedVersion: (offer?.version ?? 0) + 1,
    };
    const fingerprint = JSON.stringify(requestBody);
    let key = requestKeys.current.get(fingerprint);
    if (!key) {
      key = crypto.randomUUID();
      requestKeys.current.set(fingerprint, key);
    }
    try {
      const result = await appRequest("/api/v1/offers", {
        ...requestBody,
        idempotencyKey: key,
      }) as OfferResult;
      setOffer(result);
      setCompanyId(requestBody.companyId);
      setWorkerId(requestBody.workerId);
      setTerms(Object.fromEntries(Object.entries(normalizedTerms).map(([name, value]) => [name, String(value)])));
      if (!offer) {
        // The source text is retained only for this in-memory display. The current
        // backend contract persists typed terms, not pasted source content.
        setSourceText(sourceText);
      }
      router.push(routeFor("analyzing"));
    } catch (caught) {
      setError(caught instanceof Error ? caught : new Error("The offer could not be checked."));
    } finally {
      setBusy(false);
    }
  }

  function renderField(spec: FieldSpec) {
    const label = spec.optional ? t("add.optional", { label: t(spec.optional) }) : t(spec.label);
    const value = terms[spec.name] ?? "";
    const change = (event: { target: { value: string } }) => updateTerm(spec.name, event.target.value);
    if (spec.kind === "area") return <label className="fw-field" key={spec.name}>{label}<textarea name={spec.name} maxLength={500} value={value} onChange={change} /></label>;
    if (spec.name === "role") return <label className="fw-field" key={spec.name}>{label}<input name="role" required maxLength={120} value={value} onChange={change} /></label>;
    if (spec.name === "salary") return <label className="fw-field" key={spec.name}>{label}<input name="salary" type="number" min="0.01" step="0.01" value={value} onChange={change} /></label>;
    if (spec.name === "hoursPerWeek") return <label className="fw-field" key={spec.name}>{label}<input name="hoursPerWeek" type="number" min="0.25" step="0.25" value={value} onChange={change} /></label>;
    return <label className="fw-field" key={spec.name}>{label}<input name={spec.name} maxLength={spec.name === "currency" ? 10 : spec.name === "startDate" ? 80 : undefined} value={value} onChange={change} /></label>;
  }

  const current = METHODS.find(item => item.id === method)!;
  const showForm = method === "paste" || method === "manual";
  return (
    <>
      <h2 className="fw-page-title">{t("add.title")}</h2>
      <p className="fw-page-subtitle">{t("add.subtitle")}</p>
      <OfferDrafts onUse={draft => { startSeparateOffer(); setTerms({ role: draft.role, employerName: draft.employer }); setSourceText(draft.text); setExtraction(null); setError(null); requestKeys.current.clear(); router.replace("/app/add-offer"); }} />
      {offer && <section className="fw-card fw-offer-detail-card" aria-label="Selected offer">
        <p>{t("add.editing", { version: offer.version })}</p>
        <button type="button" className="fw-secondary" disabled={busy} onClick={() => {
          startSeparateOffer(); setExtraction(null); setError(null); requestKeys.current.clear();
          router.replace("/app/add-offer");
        }}>{t("add.separate")}</button>
      </section>}
      <h3 className="fw-intake-heading">{t("add.methodTitle")}</h3>
      <div className="fw-method-tabs" role="tablist" aria-label={t("add.methodAria")}>
        {METHODS.map(item => <button key={item.id} type="button" role="tab" id={`add-method-${item.id}`} aria-selected={method === item.id} aria-controls="add-method-panel" className={method === item.id ? "active" : ""} onClick={() => setMethod(item.id)}>{item.icon}<span>{t(item.label)}</span></button>)}
      </div>
      <p className="fw-method-hint" id="add-method-hint">{t(current.hint)}</p>
      <div id="add-method-panel" role="tabpanel" aria-labelledby={`add-method-${method}`} aria-describedby="add-method-hint">
        {method === "screenshot" && <OfferScreenshot onReviewed={applyReadText} />}
        {method === "pdf" && <OfferPdf onReviewed={applyReadText} />}
        {method === "word" && <OfferDocx onReviewed={applyReadText} />}
        {showForm && (
          <form noValidate onSubmit={event => void analyze(event)}>
            {error && <ErrorMessage error={error} />}
            {method === "paste" && (
              <section className="fw-source-panel">
                {reviewed && <p role="status" className="fw-notice">{t("add.afterUpload")}</p>}
                <label className="fw-source-label">{t("add.pasteLabel")}
                  <textarea value={sourceText} onChange={event => setSourceText(event.target.value)} placeholder={t("add.pastePlaceholder")} maxLength={10000} />
                </label>
                <p className="fw-disclaimer">{t("add.pasteNote")}</p>
                <button type="button" className="fw-secondary" disabled={!sourceText.trim()} onClick={() => {
                  const { detectedTerms } = extractOfferTermsRuleBased(sourceText);
                  const blankFields = Object.entries(detectedTerms).filter(([field]) => !terms[field]?.trim());
                  setTerms({ ...terms, ...Object.fromEntries(blankFields.map(([field, value]) => [field, String(value)])) });
                  setExtraction({ text: sourceText, filled: blankFields.length, preserved: Object.keys(detectedTerms).length - blankFields.length });
                  setReviewed(false);
                }}>{t("add.suggest")}</button>
                {extraction && extraction.text === sourceText && <><p role="status">{extraction.filled ? t("add.filled", { count: extraction.filled }) : t("add.nothingFilled")} {extraction.preserved ? t("add.preserved", { count: extraction.preserved }) : !extraction.filled ? t("add.noneDetected") : ""} {t("add.reviewEvery")}</p><RuleAnalysis text={extraction.text} /><ClauseFindings text={extraction.text} /></>}
                <QualificationPanel jobText={sourceText} />
                <AiAnalysis text={sourceText} role={role} />
              </section>
            )}
            <div className="fw-intake-review">
              <h3 className="fw-intake-heading">{t("add.reviewTitle")}</h3>
              <p className="fw-notice">{t("add.reviewIntro")}</p>
              <p className="fw-intake-progress" role="status"><span className="fw-intake-meter" aria-hidden="true"><span style={{ width: `${(keyTermsDone / KEY_TERMS.length) * 100}%` }} /></span>{t("add.progress", { done: keyTermsDone, total: KEY_TERMS.length })}</p>
              <p className="fw-notice">{t("add.leaveBlank")}</p>
            </div>
            <div role="region" aria-label={t("add.termsAria")}>
            {GROUPS.map((group, index) => (
              <section className="fw-card fw-offer-detail-card fw-intake-group" aria-labelledby={`add-group-${group.id}`} key={group.id} data-group={group.id}>
                <strong id={`add-group-${group.id}`}><span className="fw-intake-step" aria-hidden="true">{index + 1}</span>{t(group.title)}</strong>
                {group.fields.map(renderField)}
              </section>
            ))}
            </div>
            <DraftOfferAssessment terms={terms} />
            <section className="fw-card fw-offer-detail-card">
              <strong>{t("add.participants")}</strong>
              {!offer && role === "WORKER" && <p className="fw-notice">{t("add.privateDraft")}</p>}
              <label className="fw-field">{t("add.partyRole")}
                <select value={role} disabled={Boolean(offer)} onChange={event => {
                  const nextRole = event.target.value as Role;
                  setRole(nextRole);
                  setWorkerId(nextRole === "WORKER" ? profile?.id ?? "" : "");
                }}>
                  <option value="WORKER">{t("add.roleWorker")}</option>
                  <option value="EMPLOYER">{t("add.roleEmployer")}</option>
                </select>
              </label>
              {offer ? <label className="fw-field">{t("add.companyId")}<input name="companyId" readOnly value={offer.companyId} /></label> : <OfferCompanySelector value={companyId} onChange={setCompanyId} />}
              <label className="fw-field">{t("add.workerId")}<input name="workerId" required readOnly={role === "WORKER" || Boolean(offer)} pattern={"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"} title={t("add.workerIdTitle")} value={offer?.workerId ?? (role === "WORKER" ? profile?.id ?? "" : workerId)} onChange={event => setWorkerId(event.target.value)} /></label>
              <p className="fw-notice">{role === "WORKER" ? t("add.workerNote") : t("add.employerNote")}</p>
              <p className="fw-notice">{t("add.idsNote")}</p>
            </section>
            {privateResult && <section className="fw-card fw-offer-detail-card" role="region" aria-label="Analysis result">
              <p role="status"><strong>Saved to your account as a private draft (revision {privateResult.revision}).</strong> Reload the page and open “Private offer drafts” to find it. Change any term and press Analyze offer again to see the result change.</p>
              <AssessmentDetails assessment={privateResult.assessment} basis="your entered terms" />
            </section>}
            <p className="fw-disclaimer">{t("add.analyzeNote")}</p>
            <div className="fw-fixed-action">
              <button className="fw-primary" type="submit" disabled={busy}>{busy ? t("add.checking") : t("add.analyze")} <Icon name="arrow" size={18} /></button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
