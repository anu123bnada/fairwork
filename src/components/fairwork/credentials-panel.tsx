"use client";
import { useEffect, useRef, useState } from "react";
import { decodeJwt } from "jose";
import { appRequest } from "@/features/authority/client";
import type { TrustClaim } from "@/features/trust/schema";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";

export type CredentialItem = { credentialId: string; sourceId: string; sourceVersion: number; assurance: string; issuedAt: string; expiresAt: string; token: string; status: "valid" | "revoked" | "expired" | "unknown"; reason: string | null };
export type CredentialAllowance = { planName: string; limit: number; used: number; remaining: number };
export type CredentialsData = { signingConfigured: boolean; verifyBase: string; items: CredentialItem[]; allowance?: CredentialAllowance };

const when = (value: string) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
export const eligibleForCredential = (claim: TrustClaim) => claim.type === "work_performed" && claim.verification.assurance === "independently_reviewed" && claim.validity.state === "active";

async function qrFor(url: string) { const QR = (await import("qrcode")).default; return QR.toDataURL(url, { errorCorrectionLevel: "M", margin: 2, width: 240 }); }

function ShareView({ verifyUrl, expiresAt, caveat, onClose }: { verifyUrl: string; expiresAt: string; caveat: string | null; onClose: () => void }) {
  const { t } = useI18n();
  const [qr, setQr] = useState<string | null>(null), [qrError, setQrError] = useState(false), [copied, setCopied] = useState("");
  useEffect(() => {
    let active = true;
    qrFor(verifyUrl).then(value => { if (active) setQr(value); }).catch(() => { if (active) setQrError(true); });
    return () => { active = false; };
  }, [verifyUrl]);
  async function copy() {
    try { await navigator.clipboard.writeText(verifyUrl); setCopied(t("cr.copied")); } catch { setCopied(t("cr.copyFail")); }
  }
  return <div role="group" aria-label={t("cr.shareAria")}>
    {qr ? <img src={qr} width={240} height={240} alt={t("cr.qrAlt")} /> : qrError ? <p role="alert">{t("cr.qrError")}</p> : <p role="status">{t("cr.qrPreparing")}</p>}
    <label className="fw-field">{t("cr.verifyLink")}<input readOnly value={verifyUrl} onFocus={event => event.target.select()} /></label>
    <button type="button" className="fw-secondary" onClick={() => void copy()}>{t("cr.copyLink")}</button>{copied && <span role="status"> {copied}</span>}
    <p>{t("cr.anyoneWith", { date: when(expiresAt) })}</p>
    {caveat && <p role="note">{caveat}</p>}
    <button type="button" className="fw-secondary" onClick={onClose}>{t("cr.close")}</button>
  </div>;
}

export function IssueCredential({ claim, data, onIssued }: { claim: TrustClaim; data: CredentialsData; onIssued: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false), [days, setDays] = useState("90"), [statement, setStatement] = useState(claim.statement);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [issued, setIssued] = useState<{ verifyUrl: string; expiresAt: string } | null>(null);
  const key = useRef<string | null>(null);
  if (!eligibleForCredential(claim)) return null;
  if (!data.signingConfigured) return <p role="note">{t("cr.noKey")}</p>;
  async function create() {
    setBusy(true); setError("");
    try {
      key.current ??= crypto.randomUUID();
      const body: Record<string, unknown> = { workId: claim.source.id, lifetimeDays: Number(days), idempotencyKey: key.current };
      if (statement.trim() !== claim.statement) body.statement = statement.trim();
      const result = await appRequest("/api/v1/credentials", body) as { verifyUrl: string; expiresAt: string };
      key.current = null; setIssued({ verifyUrl: result.verifyUrl, expiresAt: result.expiresAt }); onIssued();
    } catch (caught) { setError(caught instanceof Error ? caught.message : t("cr.createFail")); }
    finally { setBusy(false); }
  }
  if (issued) return <ShareView verifyUrl={issued.verifyUrl} expiresAt={issued.expiresAt} caveat={claim.verification.caveat} onClose={() => { setIssued(null); setOpen(false); }} />;
  if (data.allowance && data.allowance.remaining === 0) return <p role="note">{t("cr.limitReached", { used: data.allowance.used, limit: data.allowance.limit, plan: data.allowance.planName })}</p>;
  if (!open) return <button type="button" className="fw-secondary" onClick={() => setOpen(true)}>{t("cr.create")}</button>;
  return <div role="group" aria-label={t("cr.createAria")}>
    <p>{t("cr.createIntro")}</p>
    {data.allowance && <p role="note">{t("cr.allowance", { used: data.allowance.used, limit: data.allowance.limit, plan: data.allowance.planName })}</p>}
    <label className="fw-field">{t("cr.says")}<input value={statement} maxLength={300} onChange={event => setStatement(event.target.value)} /></label>
    <label className="fw-field">{t("cr.validFor")}<select value={days} onChange={event => setDays(event.target.value)}><option value="30">{t("cr.d30")}</option><option value="90">{t("cr.d90")}</option><option value="365">{t("cr.d365")}</option></select></label>
    {error && <p role="alert">{error}</p>}
    <button type="button" className="fw-primary" disabled={busy || !statement.trim()} onClick={() => void create()}>{busy ? t("cr.creating") : t("cr.createButton")}</button>
    <button type="button" className="fw-secondary" disabled={busy} onClick={() => setOpen(false)}>{t("cr.cancel")}</button>
  </div>;
}

export function MyCredentials({ data, onChanged }: { data: CredentialsData; onChanged: () => void }) {
  const { t } = useI18n();
  const [shown, setShown] = useState<string | null>(null), [confirm, setConfirm] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  if (!data.items.length) return null;
  async function revoke(id: string) {
    setBusy(true); setError("");
    try { await appRequest("/api/v1/credentials/revoke", { credentialId: id }); setConfirm(null); onChanged(); }
    catch { setError(t("cr.revokeFail")); }
    finally { setBusy(false); }
  }
  return <section aria-label={t("cr.mine")}>
    <h4>{t("cr.mine")}</h4>
    {error && <p role="alert">{error}</p>}
    <ul>{data.items.map(item => {
      let statement = t("cr.generic"); try { statement = String((decodeJwt(item.token) as { claim?: { statement?: string } }).claim?.statement ?? statement); } catch { /* shown generically */ }
      return <li key={item.credentialId}>
        <strong>{statement}</strong> · {t(`cr.s.${item.status}` as MessageKey)}{item.reason === "source_changed" ? t("cr.recordChanged") : item.reason === "holder_requested" ? t("cr.byYou") : ""} · {t("cr.expiresLine", { date: when(item.expiresAt) })}
        {item.status === "valid" && <> <button type="button" className="fw-secondary" onClick={() => setShown(shown === item.credentialId ? null : item.credentialId)}>{shown === item.credentialId ? t("cr.hideQr") : t("cr.showQr")}</button>
          {confirm === item.credentialId
            ? <span role="group" aria-label={t("cr.confirmAria")}><button type="button" className="fw-secondary" disabled={busy} onClick={() => void revoke(item.credentialId)}>{t("cr.revokeNow")}</button><button type="button" className="fw-secondary" disabled={busy} onClick={() => setConfirm(null)}>{t("cr.keep")}</button></span>
            : <button type="button" className="fw-secondary" onClick={() => setConfirm(item.credentialId)}>{t("cr.revoke")}</button>}</>}
        {shown === item.credentialId && <ShareView verifyUrl={`${data.verifyBase}#c=${item.token}`} expiresAt={item.expiresAt} caveat={null} onClose={() => setShown(null)} />}
      </li>;
    })}</ul>
  </section>;
}
