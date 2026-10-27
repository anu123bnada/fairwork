"use client";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { AuthLink } from "./auth-link";
import { authPath } from "@/features/identity/auth-navigation";
import { participantAuthQuery } from "@/features/offer/participant-path";
import { appRequest, ApiRequestError } from "@/features/authority/client";
import { createRecoveryStore } from "./verification-store";
import { useI18n } from "@/i18n/use-i18n";
export function RecoveryForm({ confirm = false }: { confirm?: boolean }) {
  const { t } = useI18n();
  const [step, setStep] = useState(confirm ? "confirm" : "request");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [factorId, setFactorId] = useState("");
  // The link is read once, kept in memory only and stripped from the address bar. It is never consumed without the person pressing the button.
  const [link] = useState(() => createRecoveryStore(confirm));
  const context = useSyncExternalStore(link.subscribe, link.getSnapshot, link.getServerSnapshot);
  async function checkAuthenticator() {
    const mfa = await appRequest("/api/v1/auth/mfa");
    const factor = mfa.factors.find((f: { status: string }) => f.status === "verified");
    if (factor) { setFactorId(factor.id); setStep("mfa"); }
    else setStep("password");
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (step === "request") {
        await appRequest("/api/v1/auth/recovery", { email: data.get("email"), continuation: participantAuthQuery(window.location.search) }); setStep("sent");
      } else if (step === "confirm") {
        const current = link.getSnapshot();
        if (current?.kind !== "ready" && current?.kind !== "session") throw new Error(t("au.rec.linkUsedError"));
        await appRequest("/api/v1/auth/recovery/confirm", current.kind === "ready" ? { tokenHash: current.tokenHash } : { accessToken: current.accessToken, refreshToken: current.refreshToken, link: current.link });
        link.clear();
        window.history.replaceState(null, "", authPath("/auth/recover", window.location.search));
        // The one-use link is consumed. Retry only the assurance lookup if it
        // fails; never expose password entry before that lookup succeeds.
        setStep("assurance");
        await checkAuthenticator();
      } else if (step === "assurance") {
        await checkAuthenticator();
      } else if (step === "mfa") {
        await appRequest("/api/v1/auth/mfa", { action: "verify", factorId, code: data.get("code") }); setStep("password");
      } else {
        if (data.get("password") !== data.get("confirmPassword")) throw new Error(t("au.rec.mismatch"));
        await appRequest("/api/v1/auth/password", { password: data.get("password") }); setStep("done");
      }
    } catch (caught) {
      // A consumed, expired or forged link is not retryable; say so plainly instead of the generic field message.
      if (step === "confirm" && caught instanceof ApiRequestError && ["AUTH_REQUIRED", "VALIDATION_FAILED"].includes(caught.code)) { link.clear(); setError(t("au.rec.linkUsedError")); }
      else if (step === "password" && caught instanceof ApiRequestError && caught.code === "SAME_PASSWORD") setError(t("au.rec.samePassword"));
      else if (step === "password" && caught instanceof ApiRequestError && caught.code === "WEAK_PASSWORD") setError(t("au.rec.weakPassword"));
      // The reset session ended (timed out, or was revoked) before the new password was saved: only a new email can continue, so say so and offer one.
      else if (step === "password" && caught instanceof ApiRequestError && ["RESET_EXPIRED", "AUTH_REQUIRED"].includes(caught.code)) { link.clear(); setError(""); setStep("confirm"); }
      else setError(caught instanceof Error ? caught.message : t("au.rec.failed"));
    }
    finally { setBusy(false); }
  }
  if (step === "sent") return <section className="fw-auth-result"><span className="fw-result-icon" aria-hidden="true">✉</span><h2>{t("au.rec.sentTitle")}</h2><p role="status">{t("au.rec.sentStatus")}</p><p>{t("au.rec.sentNote")}</p><button type="button" onClick={() => setStep("request")}>{t("au.rec.anotherEmail")}</button><p><AuthLink href="/sign-in">{t("au.backToSignIn")}</AuthLink></p></section>;
  if (step === "done") return <section className="fw-auth-result"><span className="fw-result-icon" aria-hidden="true">✓</span><h2>{t("au.rec.doneTitle")}</h2><p role="status">{t("au.rec.doneStatus")}</p><AuthLink className="fw-primary" href="/sign-in">{t("au.signIn")}</AuthLink></section>;
  if (step === "confirm" && context?.kind !== "ready" && context?.kind !== "session") return <section className="fw-auth-result">
    <span className="fw-result-icon" aria-hidden="true">✉</span>
    <h2>{!context ? t("au.rec.checkingLink") : context.kind === "missing" ? t("au.rec.openEmail") : context.kind === "expired" ? t("au.rec.linkExpired") : context.kind === "unsupported" ? t("au.rec.linkUnsupported") : t("au.rec.linkUnusable")}</h2>
    <p role={context ? "alert" : "status"}>{!context ? t("au.rec.waitFormat") : context.kind === "unsupported" ? t("au.rec.unsupportedBody") : t("au.rec.useLatest")}</p>
    {context && <AuthLink className="fw-primary" href="/forgot-password">{t("au.rec.requestNew")}</AuthLink>}
    <p><AuthLink href="/sign-in">{t("au.backToSignIn")}</AuthLink></p>
  </section>;
  return <><form onSubmit={event => void submit(event)} aria-busy={busy}>
    {step === "request" && <label>{t("au.email")}<input name="email" type="email" autoComplete="username" required maxLength={254}/></label>}
    {step === "confirm" && <p>{context?.kind === "session" && context.link === "invite" ? t("au.rec.inviteNote") : t("au.rec.confirmNote")}</p>}
    {step === "assurance" && <p>{t("au.rec.assuranceNote")}</p>}
    {step === "mfa" && <><p>{t("au.rec.mfaNote")}</p><label>{t("au.rec.code")}<input name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required/></label><p>{t("au.rec.lostNote")}</p></>}
    {step === "password" && <><label>{t("au.rec.newPassword")}<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><label>{t("au.rec.confirmNew")}<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><p>{t("au.rec.signsOut")}</p></>}
    {error && <p role="alert">{error}</p>}
    <button className="fw-primary" disabled={busy}>{busy ? t("au.reg.wait") : step === "request" ? t("au.rec.send") : step === "confirm" ? t("au.rec.confirmLink") : step === "assurance" ? t("au.rec.retryAuth") : step === "mfa" ? t("au.rec.verifyAuth") : t("au.rec.saveNew")}</button>
  </form><p><AuthLink href="/sign-in">{t("au.backToSignIn")}</AuthLink></p></>;
}
