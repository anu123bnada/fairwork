"use client";
import { useEffect, useRef, useState } from "react";
import { decodeJwt } from "jose";
import { appRequest } from "@/features/authority/client";
import type { TrustClaim } from "@/features/trust/schema";

export type CredentialItem = { credentialId: string; sourceId: string; sourceVersion: number; assurance: string; issuedAt: string; expiresAt: string; token: string; status: "valid" | "revoked" | "expired" | "unknown"; reason: string | null };
export type CredentialsData = { signingConfigured: boolean; verifyBase: string; items: CredentialItem[] };

const STATUS = { valid: "Valid", revoked: "Revoked", expired: "Expired", unknown: "Unknown" } as const;
const when = (value: string) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
export const eligibleForCredential = (claim: TrustClaim) => claim.type === "work_performed" && claim.verification.assurance === "independently_reviewed" && claim.validity.state === "active";

async function qrFor(url: string) { const QR = (await import("qrcode")).default; return QR.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 240 }); }

function ShareView({ verifyUrl, expiresAt, caveat, onClose }: { verifyUrl: string; expiresAt: string; caveat: string | null; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null), [qrError, setQrError] = useState(false), [copied, setCopied] = useState("");
  useEffect(() => {
    let active = true;
    qrFor(verifyUrl).then(value => { if (active) setQr(value); }).catch(() => { if (active) setQrError(true); });
    return () => { active = false; };
  }, [verifyUrl]);
  async function copy() {
    try { await navigator.clipboard.writeText(verifyUrl); setCopied("Link copied."); } catch { setCopied("Copying is not available here. Select the link and copy it manually."); }
  }
  return <div role="group" aria-label="Share this credential">
    {qr ? <img src={qr} width={240} height={240} alt="QR code that opens the credential verification page" /> : qrError ? <p role="alert">The QR code could not be drawn. Use the link instead.</p> : <p role="status">Preparing QR code…</p>}
    <label className="fw-field">Verification link<input readOnly value={verifyUrl} onFocus={event => event.target.select()} /></label>
    <button type="button" className="fw-secondary" onClick={() => void copy()}>Copy link</button>{copied && <span role="status"> {copied}</span>}
    <p>Anyone with this link or QR code can see the statement shown above and check whether it is still valid, until {when(expiresAt)}. You can revoke it at any time.</p>
    {caveat && <p role="note">{caveat}</p>}
    <button type="button" className="fw-secondary" onClick={onClose}>Close</button>
  </div>;
}

export function IssueCredential({ claim, data, onIssued }: { claim: TrustClaim; data: CredentialsData; onIssued: () => void }) {
  const [open, setOpen] = useState(false), [days, setDays] = useState("90"), [statement, setStatement] = useState(claim.statement);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [issued, setIssued] = useState<{ verifyUrl: string; expiresAt: string } | null>(null);
  const key = useRef<string | null>(null);
  if (!eligibleForCredential(claim)) return null;
  if (!data.signingConfigured) return <p role="note">Credentials cannot be created yet: this server has no signing key configured.</p>;
  async function create() {
    setBusy(true); setError("");
    try {
      key.current ??= crypto.randomUUID();
      const body: Record<string, unknown> = { workId: claim.source.id, lifetimeDays: Number(days), idempotencyKey: key.current };
      if (statement.trim() !== claim.statement) body.statement = statement.trim();
      const result = await appRequest("/api/v1/credentials", body) as { verifyUrl: string; expiresAt: string };
      key.current = null; setIssued({ verifyUrl: result.verifyUrl, expiresAt: result.expiresAt }); onIssued();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The credential could not be created. Retry; the same request is reused so it is not duplicated."); }
    finally { setBusy(false); }
  }
  if (issued) return <ShareView verifyUrl={issued.verifyUrl} expiresAt={issued.expiresAt} caveat={claim.verification.caveat} onClose={() => { setIssued(null); setOpen(false); }} />;
  if (!open) return <button type="button" className="fw-secondary" onClick={() => setOpen(true)}>Create a shareable credential</button>;
  return <div role="group" aria-label="Create a credential">
    <p>A credential lets someone check this claim without seeing your account. You choose what it says and how long it lasts.</p>
    <label className="fw-field">What it says (you can shorten it, not add to it)<input value={statement} maxLength={300} onChange={event => setStatement(event.target.value)} /></label>
    <label className="fw-field">Valid for<select value={days} onChange={event => setDays(event.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="365">1 year</option></select></label>
    {error && <p role="alert">{error}</p>}
    <button type="button" className="fw-primary" disabled={busy || !statement.trim()} onClick={() => void create()}>{busy ? "Creating…" : "Create credential"}</button>
    <button type="button" className="fw-secondary" disabled={busy} onClick={() => setOpen(false)}>Cancel</button>
  </div>;
}

export function MyCredentials({ data, onChanged }: { data: CredentialsData; onChanged: () => void }) {
  const [shown, setShown] = useState<string | null>(null), [confirm, setConfirm] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  if (!data.items.length) return null;
  async function revoke(id: string) {
    setBusy(true); setError("");
    try { await appRequest("/api/v1/credentials/revoke", { credentialId: id }); setConfirm(null); onChanged(); }
    catch { setError("The credential could not be revoked. Retry; nothing was reported as revoked."); }
    finally { setBusy(false); }
  }
  return <section aria-label="Your credentials">
    <h4>Your credentials</h4>
    {error && <p role="alert">{error}</p>}
    <ul>{data.items.map(item => {
      let statement = "Credential"; try { statement = String((decodeJwt(item.token) as { claim?: { statement?: string } }).claim?.statement ?? statement); } catch { /* shown generically */ }
      return <li key={item.credentialId}>
        <strong>{statement}</strong> · {STATUS[item.status]}{item.reason === "source_changed" ? " (the record changed)" : item.reason === "holder_requested" ? " (revoked by you)" : ""} · expires {when(item.expiresAt)}
        {item.status === "valid" && <> <button type="button" className="fw-secondary" onClick={() => setShown(shown === item.credentialId ? null : item.credentialId)}>{shown === item.credentialId ? "Hide QR" : "Show QR"}</button>
          {confirm === item.credentialId
            ? <span role="group" aria-label="Confirm revoking"><button type="button" className="fw-secondary" disabled={busy} onClick={() => void revoke(item.credentialId)}>Revoke now</button><button type="button" className="fw-secondary" disabled={busy} onClick={() => setConfirm(null)}>Keep it</button></span>
            : <button type="button" className="fw-secondary" onClick={() => setConfirm(item.credentialId)}>Revoke</button>}</>}
        {shown === item.credentialId && <ShareView verifyUrl={`${data.verifyBase}#c=${item.token}`} expiresAt={item.expiresAt} caveat={null} onClose={() => setShown(null)} />}
      </li>;
    })}</ul>
  </section>;
}
