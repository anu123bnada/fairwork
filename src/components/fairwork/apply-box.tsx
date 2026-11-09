"use client";
import { useState } from "react";
import { ApiRequestError, appRequest } from "@/features/authority/client";
import { commandResult } from "@/features/applications/schema";
import { useI18n } from "@/i18n/use-i18n";
import "./records.css";

// Apply to a listing that exists on this platform. Only the display name and the message below are shared with the organization that published it.
export function ApplyBox({ listingId, title }: { listingId: string; title: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false), [message, setMessage] = useState(""), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState("");
  async function send() {
    setBusy(true); setError("");
    try { commandResult.parse(await appRequest("/api/v1/applications", { action: "submit", id: crypto.randomUUID(), listingId, message: message.trim() })); setDone(true); }
    catch (caught) { setError(caught instanceof ApiRequestError && caught.code === "VALIDATION_FAILED" ? t("apl.refused") : caught instanceof ApiRequestError && caught.code === "NOT_FOUND" ? t("apl.gone") : t("apl.error")); }
    finally { setBusy(false); }
  }
  if (done) return <p role="status">{t("apl.sent", { title })}</p>;
  if (!open) return <button className="fw-primary" onClick={() => setOpen(true)}>{t("apl.open", { title })}</button>;
  return <div className="oq-rec-group" role="group" aria-label={t("apl.aria", { title })}>
    <p className="fw-notice">{t("apl.shares")}</p>
    <label className="fw-field">{t("apl.message")}<textarea maxLength={1000} value={message} onChange={e => setMessage(e.target.value)} /></label>
    {error && <p role="alert">{error}</p>}
    <button className="fw-primary" disabled={busy} onClick={() => void send()}>{t("apl.send")}</button>
    <button className="fw-secondary" disabled={busy} onClick={() => setOpen(false)}>{t("apl.cancel")}</button>
  </div>;
}
