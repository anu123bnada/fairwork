"use client";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import type { JWK } from "jose";
import { verifyCredential, type CredentialPayload } from "@/features/credentials/core";

const subscribe = (callback: () => void) => { window.addEventListener("hashchange", callback); return () => window.removeEventListener("hashchange", callback); };
// The credential travels in the URL fragment, which browsers never send to the server.
const readHash = () => /^#c=([A-Za-z0-9_.-]{1,4096})$/.exec(window.location.hash)?.[1] ?? "";

type Status = { status: "valid" | "revoked" | "expired" | "unknown"; reason: string | null; checkedAt: string };
type Outcome =
  | { kind: "invalid"; reason: string }
  | { kind: "no_keys" }
  | { kind: "checked"; payload: CredentialPayload; status: Status | null };
const REASONS: Record<string, string> = {
  malformed: "This is not a valid ORYQEN credential.", unsupported_algorithm: "This is not a valid ORYQEN credential.",
  unknown_key: "It was signed with a key ORYQEN does not publish.", bad_signature: "The signature does not match. The credential was altered, or it was not issued by ORYQEN.",
  wrong_issuer: "It was issued by a different issuer than this site.", expired: "This credential has expired.", not_yet_valid: "This credential is not valid yet.",
  invalid_payload: "The credential's contents are not acceptable.", revoked: "This credential has been revoked.",
};
const ASSURANCE = { independently_reviewed: "Reviewed by an employer representative", counterparty_acknowledged: "Acknowledged by both parties" } as const;
const date = (value: string | number | null) => value === null ? null : new Date(typeof value === "number" ? value * 1000 : value).toLocaleString(undefined, { dateStyle: "long", timeStyle: "short" });

async function check(token: string): Promise<Outcome> {
  let keys: { issuer: string; keys: (JWK & { kid: string })[] };
  try {
    const response = await fetch("/.well-known/oryqen-keys.json", { cache: "no-store", credentials: "omit" });
    if (!response.ok) return { kind: "no_keys" };
    keys = await response.json();
  } catch { return { kind: "no_keys" }; }
  const publicKeys = Object.fromEntries((keys.keys ?? []).map(key => [key.kid, key]));
  const result = await verifyCredential(token, { issuer: keys.issuer, publicKeys, now: new Date() });
  if (!result.valid) return { kind: "invalid", reason: result.reason };
  try {
    const response = await fetch(`/api/v1/credentials/status?id=${result.payload.jti}`, { cache: "no-store", credentials: "omit" });
    if (!response.ok) return { kind: "checked", payload: result.payload, status: null };
    return { kind: "checked", payload: result.payload, status: (await response.json()).data as Status };
  } catch { return { kind: "checked", payload: result.payload, status: null }; }
}

export function CredentialVerifier() {
  const fromLink = useSyncExternalStore(subscribe, readHash, () => "");
  const [pasted, setPasted] = useState(""), [draft, setDraft] = useState("");
  const token = pasted || fromLink;
  const [done, setDone] = useState<{ token: string; outcome: Outcome } | null>(null);
  useEffect(() => {
    if (!token) return;
    let active = true;
    void check(token).then(outcome => { if (active) setDone({ token, outcome }); });
    return () => { active = false; };
  }, [token]);
  const outcome = done?.token === token ? done.outcome : null;
  function submit(event: FormEvent) { event.preventDefault(); const value = draft.trim(); if (/^[A-Za-z0-9_.-]{1,4096}$/.test(value)) setPasted(value); }

  let headline = "", tone: "good" | "bad" | "warn" = "warn", detail = "";
  if (outcome?.kind === "invalid") { headline = "Not verified"; tone = "bad"; detail = REASONS[outcome.reason] ?? REASONS.malformed!; }
  else if (outcome?.kind === "no_keys") { headline = "Could not check"; detail = "ORYQEN's published keys could not be loaded, so the signature cannot be checked. Try again later."; }
  else if (outcome?.kind === "checked") {
    const s = outcome.status?.status;
    if (s === "valid") { headline = "Valid credential"; tone = "good"; detail = "The signature is genuine and ORYQEN's records still support this claim."; }
    else if (s === "revoked") { headline = "Revoked"; tone = "bad"; detail = outcome.status?.reason === "source_changed" ? "The record behind this credential has changed since it was issued, so it no longer holds." : "The holder revoked this credential."; }
    else if (s === "expired") { headline = "Expired"; tone = "bad"; detail = "The credential's validity period has ended."; }
    else if (s === "unknown") { headline = "Cannot confirm"; tone = "bad"; detail = "The signature is genuine, but this credential is not in ORYQEN's register."; }
    else { headline = "Signature valid, status unchecked"; detail = "The signature is genuine, but its current status could not be checked. Try again later."; }
  }
  return <section className="fw-list-card fw-verify-card" aria-label="Credential verification">
    <h1>Verify an ORYQEN credential</h1>
    <p>Check that a credential is genuine and still valid. The credential in a link or QR code stays in your browser and is never sent to the server; only its random identifier is sent to check its status.</p>
    {!token && <form onSubmit={submit}>
      <label className="fw-field">Paste a credential<textarea value={draft} maxLength={4096} onChange={event => setDraft(event.target.value)} /></label>
      <button className="fw-primary" disabled={!draft.trim()}>Check credential</button>
      <p>Or open the link or scan the QR code you were given.</p>
    </form>}
    {token && !outcome && <p role="status">Checking…</p>}
    {outcome && <div role="status" className={`fw-verify-result fw-verify-${tone}`}>
      <h2>{headline}</h2><p>{detail}</p>
      {outcome.kind === "checked" && <dl>
        <dt>Claim</dt><dd>{outcome.payload.claim.statement}</dd>
        <dt>Assurance</dt><dd>{ASSURANCE[outcome.payload.claim.assurance]}{outcome.payload.claim.assuranceAt ? `, ${date(outcome.payload.claim.assuranceAt)}` : ""}</dd>
        <dt>Issued</dt><dd>{date(outcome.payload.iat)}</dd><dt>Expires</dt><dd>{date(outcome.payload.exp)}</dd>
        <dt>Issuer</dt><dd>{outcome.payload.iss}</dd><dt>Reference</dt><dd>{outcome.payload.claim.claimRef.slice(0, 16)}…</dd>
        {outcome.payload.claim.caveat && <><dt>Important</dt><dd>{outcome.payload.claim.caveat}</dd></>}
      </dl>}
      <details><summary>What this does and does not show</summary><ul>
        <li>It shows that ORYQEN signed this statement and whether ORYQEN's records still support it.</li>
        <li>It does not show that a person or employer is trustworthy, and it is not a legal, government or professional certification.</li>
        <li>The holder chose what to disclose. Anything not shown here is not claimed.</li></ul></details>
    </div>}
    {token && <button type="button" className="fw-secondary" onClick={() => { setPasted(""); setDraft(""); setDone(null); window.history.replaceState(null, "", window.location.pathname); window.dispatchEvent(new HashChangeEvent("hashchange")); }}>Check another credential</button>}
  </section>;
}
