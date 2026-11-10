"use client";
import { useMemo, useState } from "react";
import { scamIndicators } from "@/features/scam/check";
import "./records.css";

const sample = "Hello! You are selected for a remote data entry job, salary LKR 150,000 per month. Interview only on WhatsApp. To secure your position please pay a registration fee of LKR 5,000 before you start. This is a guaranteed job. Reply from hr.recruit2026@gmail.com today.";

// Recruiter message check (public, device only). Rule-based wording checks that quote the text they matched. It is a second look, not a verdict: it never says a person or company is
// fraudulent, and a clean result does not say a message is safe. Nothing typed here leaves this device.
export function RecruiterCheck() {
  const [text, setText] = useState(""), [domain, setDomain] = useState("");
  const indicators = useMemo(() => (text.trim() ? scamIndicators(text, domain.trim() ? { companyDomain: domain.trim() } : {}) : null), [text, domain]);
  return <section className="oq-rec" aria-label="Recruiter message check">
    <p className="fw-notice" role="note" data-demo="sample"><strong>DEMO MODE.</strong> Fixed wording rules that run on this device. Nothing you type is sent anywhere. These are not verdicts about any person or company.</p>
    <label className="fw-field">Paste a recruiter message or job advertisement<textarea rows={8} maxLength={6000} value={text} onChange={e => setText(e.target.value)} /></label>
    <label className="fw-field">Company website domain, if you know it (optional, e.g. example.com)<input maxLength={120} value={domain} onChange={e => setDomain(e.target.value)} /></label>
    <button type="button" className="fw-secondary" onClick={() => setText(sample)}>Paste a sample message (DEMO)</button>
    {indicators === null ? <p>Paste a message to see which wording deserves a second look.</p> : indicators.length === 0
      ? <p role="status">No indicators matched. This does not mean the message is safe: check the company through an independent channel before sharing documents or paying anything.</p>
      : <ul aria-label="Indicators" className="oq-rec-list">{indicators.map(item => <li key={item.id}>
        <strong>{item.severity === "high" ? "Higher concern" : "Worth a second look"}: {item.title}</strong>
        <p>Matched text: “{item.quote}”</p><p>{item.description}</p><p><em>{item.recommendation}</em></p>
      </li>)}</ul>}
    <p className="fw-notice">Allegations are not findings. To report a suspicious recruiter privately and have it reviewed, sign in and use the report option in the app.</p>
  </section>;
}
