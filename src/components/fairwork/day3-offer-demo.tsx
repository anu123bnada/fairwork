"use client";

import { useMemo, useState } from "react";

const DEFAULT_TERMS = {
  salary: 120000,
  currency: "USD",
  startDate: "2027-01-15",
  hoursPerWeek: 40,
  responsibilities: "Ship the MVP and review churn risk.",
};

type OfferReview = {
  offerId: string;
  companyId: string;
  workerId: string;
  version: number;
  requesterRole: "EMPLOYER" | "WORKER";
  requesterId: string;
  termHash: string;
  unresolved: Array<{ id: string; field: string; question: string; required: boolean }>;
  snapshot: Record<string, string | number>;
  idempotent?: boolean;
};

type AgreementStatus = {
  agreementId: string;
  offerId: string;
  version: number;
  confirmedBy: string;
  confirmationRole: "EMPLOYER" | "WORKER";
  currentHash: string;
  status: "awaiting_other_party" | "confirmed";
  idempotent?: boolean;
};

export function Day3OfferDemo() {
  const [companyId, setCompanyId] = useState("40000000-0000-4000-8000-000000000001");
  const [workerId, setWorkerId] = useState("40000000-0000-4000-8000-000000000002");
  const [requesterRole, setRequesterRole] = useState<"EMPLOYER" | "WORKER">("EMPLOYER");
  const [terms, setTerms] = useState(DEFAULT_TERMS);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(new Set());
  const [offerReview, setOfferReview] = useState<OfferReview | null>(null);
  const [agreementState, setAgreementState] = useState<AgreementStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const offerId = useMemo(() => crypto.randomUUID(), []);
  const agreementId = useMemo(() => crypto.randomUUID(), []);

  const updateTerm = (field: string, value: string) => {
    setTerms((current) => ({
      ...current,
      [field]: field === "salary" || field === "hoursPerWeek" ? Number(value) : value,
    }));
  };

  async function submitOffer() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/offers", {
        method: "POST",
        headers: {
          origin: window.location.origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          offerId,
          companyId,
          workerId,
          requesterRole,
          terms,
          expectedVersion: (offerReview?.version ?? 0) + 1,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error?.message ?? "Offer review failed");
      }
      setOfferReview(json.data);
      setAnswers({});
      setAnsweredQuestionIds(new Set());
      setAgreementState(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Offer review failed");
    } finally {
      setBusy(false);
    }
  }

  async function answerQuestion(questionId: string) {
    if (!offerReview) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/offers/answers", {
        method: "POST",
        headers: {
          origin: window.location.origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          offerId: offerReview.offerId,
          offerVersion: offerReview.version,
          questionId,
          answer: answers[questionId] ?? "",
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error?.message ?? "Question answer failed");
      }
      setAnsweredQuestionIds((current) => new Set(current).add(questionId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Question answer failed");
    } finally {
      setBusy(false);
    }
  }

  async function confirmAgreement() {
    if (!offerReview) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/agreements", {
        method: "POST",
        headers: {
          origin: window.location.origin,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          agreementId,
          offerId: offerReview.offerId,
          companyId: offerReview.companyId,
          workerId: offerReview.workerId,
          confirmationRole: requesterRole,
          expectedVersion: offerReview.version,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error?.message ?? "Agreement confirmation failed");
      }
      setAgreementState(json.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Agreement confirmation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>ORYQEN Day 3 developer sandbox</h1>
      <p>Developer sandbox for the database-backed offer and agreement commands. The server verifies signed-in identity and company authority; the form fields are never authorization proof.</p>
      <div>
        <label htmlFor="companyId">Company ID</label>
        <input id="companyId" value={companyId} onChange={(event) => setCompanyId(event.target.value)} />
      </div>
      <div>
        <label htmlFor="workerId">Worker ID</label>
        <input id="workerId" value={workerId} onChange={(event) => setWorkerId(event.target.value)} />
      </div>
      <div>
        <label htmlFor="requesterRole">Party role to request</label>
        <select id="requesterRole" value={requesterRole} onChange={(event) => setRequesterRole(event.target.value as "EMPLOYER" | "WORKER")}>
          <option value="EMPLOYER">EMPLOYER</option>
          <option value="WORKER">WORKER</option>
        </select>
      </div>

      <h2>Offer terms</h2>
      <div>
        <label htmlFor="salary">Salary</label>
        <input id="salary" type="number" value={Number(terms.salary ?? 0)} onChange={(event) => updateTerm("salary", event.target.value)} />
      </div>
      <div>
        <label htmlFor="currency">Currency</label>
        <input id="currency" value={String(terms.currency ?? "USD")} onChange={(event) => updateTerm("currency", event.target.value)} />
      </div>
      <div>
        <label htmlFor="startDate">Start date</label>
        <input id="startDate" value={String(terms.startDate ?? "")} onChange={(event) => updateTerm("startDate", event.target.value)} />
      </div>
      <div>
        <label htmlFor="hoursPerWeek">Hours per week</label>
        <input id="hoursPerWeek" type="number" value={Number(terms.hoursPerWeek ?? 0)} onChange={(event) => updateTerm("hoursPerWeek", event.target.value)} />
      </div>
      <div>
        <label htmlFor="responsibilities">Responsibilities</label>
        <textarea id="responsibilities" value={String(terms.responsibilities ?? "")} onChange={(event) => updateTerm("responsibilities", event.target.value)} />
      </div>

      <button type="button" onClick={submitOffer} disabled={busy}>
        {offerReview ? "Submit offer amendment" : "Submit offer review"}
      </button>
      {offerReview ? (
        <div>
          <h2>Offer review</h2>
          <p>Hash: {offerReview.termHash}</p>
          <p>Version: {offerReview.version}</p>
          <h3>Questions</h3>
          {offerReview.unresolved.length === 0 ? <p>No required terms are unresolved.</p> : (
            <ul>
              {offerReview.unresolved.map((question) => (
                <li key={question.id}>
                  <p>{question.question}</p>
                  {answeredQuestionIds.has(question.id) ? <p>Answer recorded for this offer revision.</p> : (
                    <>
                      <label htmlFor={`answer-${question.id}`}>Answer</label>
                      <textarea
                        id={`answer-${question.id}`}
                        value={answers[question.id] ?? ""}
                        onChange={(event) => setAnswers((current) => ({
                          ...current,
                          [question.id]: event.target.value,
                        }))}
                      />
                      <button type="button" onClick={() => answerQuestion(question.id)} disabled={busy}>
                        Record answer
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={confirmAgreement}
            disabled={busy || offerReview.unresolved.some((question) => !answeredQuestionIds.has(question.id))}
          >
            Confirm as {requesterRole.toLowerCase()}
          </button>
        </div>
      ) : null}

      {agreementState ? (
        <div>
          <h2>Agreement result</h2>
          <p>{agreementState.status === "confirmed" ? "Agreement confirmed by both parties." : "Waiting for the other independently authenticated party."}</p>
          <pre>{JSON.stringify(agreementState, null, 2)}</pre>
        </div>
      ) : null}

      {error ? <p role="alert">{error}</p> : null}
    </div>
  );
}
