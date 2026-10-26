"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { appRequest, ApiRequestError } from "@/features/authority/client";
import { participantDestination, participantAuthQuery } from "@/features/offer/participant-path";
import { authPath } from "@/features/identity/auth-navigation";
import { AuthLink } from "./auth-link";
import { createVerificationStore } from "./verification-store";
import { useI18n } from "@/i18n/use-i18n";

export function RegistrationForm({ confirmation = false, profile = false, displayName = "" }: { confirmation?: boolean; profile?: boolean; displayName?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [mismatch, setMismatch] = useState(false);
  const [step, setStep] = useState(profile ? "profile" : confirmation ? "confirm" : "choose");
  const [account, setAccount] = useState("worker");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [retryAt, setRetryAt] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [verification] = useState(() => createVerificationStore(confirmation));
  const context = useSyncExternalStore(verification.subscribe, verification.getSnapshot, verification.getServerSnapshot);
  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);
  function beginCooldown() { setRetryAt(Date.now() + 60000); setRemaining(60); }
  const [profileKey] = useState(() => crypto.randomUUID());

  function choose(kind: string) {
    const query = new URLSearchParams(participantAuthQuery(window.location.search));
    if (kind === "employer") query.set("workspace", "employer"); else query.delete("workspace");
    window.history.replaceState(null, "", authPath("/register", query.toString()));
    setAccount(kind); setStep("register"); setError("");
  }
  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    if (Date.now() < retryAt) { setError(t("au.reg.resendWait")); return; }
    setBusy(true);
    try {
      await appRequest("/api/v1/auth/resend", { email, continuation: participantAuthQuery(window.location.search) });
      beginCooldown();
      setMessage(t("au.reg.resendDone"));
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === "RATE_LIMITED") beginCooldown();
      setError(caught instanceof Error ? caught.message : t("au.reg.resendFailed"));
    }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMismatch(false);
    const element = event.currentTarget;
    const form = new FormData(element);
    try {
      if (step === "register") {
        if (form.get("password") !== form.get("confirmPassword")) {
          (element.elements.namedItem("confirmPassword") as HTMLInputElement).focus();
          setMismatch(true);
          throw new Error(t("au.reg.mismatch"));
        }
        const name = String(form.get("displayName") ?? "").trim();
        if (!name) throw new Error(t("au.reg.needName"));
        await appRequest("/api/v1/auth/register", { email, password: form.get("password"), displayName: name, continuation: participantAuthQuery(window.location.search) });
        beginCooldown(); setStep("sent");
      } else if (step === "confirm") {
        const current = verification.getSnapshot();
        if (!current || !["ready", "session"].includes(current.kind)) throw new Error(t("au.reg.openLink"));
        const credentials = current.kind === "ready" ? { tokenHash: current.tokenHash }
          : current.kind === "session" ? { accessToken: current.accessToken, refreshToken: current.refreshToken } : null;
        const result = await appRequest("/api/v1/auth/confirm", credentials);
        if (result?.confirmed !== true) throw new Error(t("au.reg.noSession"));
        verification.clear();
        const query = participantAuthQuery(window.location.search);
        window.history.replaceState(null, "", authPath("/auth/confirm", query));
        router.replace(authPath("/register/profile", query)); router.refresh();
      } else {
        const name = String(form.get("displayName") ?? "").trim();
        if (!name) throw new Error(t("au.reg.needDisplay"));
        await appRequest("/api/v1/me", { displayName: name, locale: "en", timeZone: form.get("timeZone") }, profileKey);
        router.replace(participantDestination(window.location.search) ?? "/app/intro-welcome"); router.refresh();
      }
    } catch (caught) {
      if (step === "confirm" && caught instanceof ApiRequestError && caught.code === "AUTH_REQUIRED") verification.clear();
      setError(step === "confirm" && caught instanceof ApiRequestError && caught.code === "AUTH_REQUIRED"
        ? t("au.reg.linkInvalid")
        : caught instanceof Error ? caught.message : t("au.reg.cannotContinue"));
    }
    finally { setBusy(false); }
  }
  return <div className="fw-auth-flow">
    <ol className="fw-auth-steps" aria-label={t("au.reg.progress")}>
      {[t("au.reg.stepAccount"), t("au.reg.stepVerify"), t("au.reg.stepProfile")].map((label, index) => <li key={label} aria-current={(step === "profile" ? 2 : ["sent", "confirm"].includes(step) ? 1 : 0) === index ? "step" : undefined}><span>{index + 1}</span>{label}</li>)}
    </ol>
    {step === "choose" ? <section className="fw-account-choices" aria-label={t("au.reg.choose")}>
      <h2>{t("au.reg.howUse")}</h2><p>{t("au.reg.chooseStart")}</p>
      <button type="button" onClick={() => choose("worker")}><span className="fw-choice-icon" aria-hidden="true">01</span><span><strong>{t("au.reg.worker")}</strong><small>{t("au.reg.workerSub")}</small></span><span aria-hidden="true">→</span></button>
      <button type="button" onClick={() => choose("employer")}><span className="fw-choice-icon" aria-hidden="true">02</span><span><strong>{t("au.reg.employer")}</strong><small>{t("au.reg.employerSub")}</small></span><span aria-hidden="true">→</span></button>
      <p className="fw-auth-note">{t("au.reg.employerNote")}</p>
    </section> : step === "sent" ? <section className="fw-auth-result">
      <span className="fw-result-icon" aria-hidden="true">✉</span><h2>{t("au.reg.checkInbox")}</h2>
      <p role="status">{t("au.reg.sentStatus")}</p>
      <p>{t("au.reg.sentNext")}</p>
    </section> : step === "confirm" && context?.kind !== "ready" && context?.kind !== "session" ? <section className="fw-auth-result">
      <span className="fw-result-icon" aria-hidden="true">✉</span>
      <h2>{!context ? t("au.reg.checkingLink") : context.kind === "missing" ? t("au.reg.openEmail") : context.kind === "expired" ? t("au.reg.linkExpired") : t("au.reg.linkUnusable")}</h2>
      <p>{!context ? t("au.reg.waitFormat") : t("au.reg.useLatest")}</p>
    </section> : <form onSubmit={event => void submit(event)} aria-busy={busy}>
      {step === "register" && <>
        <div className="fw-auth-selection"><strong>{t("au.reg.accountType", { kind: account === "employer" ? t("au.reg.kindEmployer") : t("au.reg.kindWorker") })}</strong><button type="button" onClick={() => setStep("choose")} disabled={busy}>{t("au.reg.change")}</button></div>
        <label>{t("au.reg.yourName")}<input name="displayName" autoComplete="name" maxLength={80} required /></label>
        <label>{t("au.email")}<input type="email" name="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required maxLength={254} /></label>
        <label>{t("au.password")}<input type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128} aria-describedby="registration-password-help" required /></label>
        <p id="registration-password-help" className="fw-field-help">{t("au.reg.passwordHelp")}</p>
        <label>{t("au.reg.confirmPassword")}<input type="password" name="confirmPassword" autoComplete="new-password" minLength={12} maxLength={128} aria-invalid={mismatch || undefined} aria-describedby={mismatch ? "registration-error" : undefined} required /></label>
      </>}
      {step === "confirm" && <p>{context?.kind === "session" ? t("au.reg.confirmSession") : t("au.reg.confirmEmailTo")} {t("au.reg.onlyIfRequested")}</p>}
      {step === "profile" && <>
        <p>{t("au.reg.profileIntro")}</p>
        <label>{t("au.reg.displayName")}<input name="displayName" defaultValue={displayName} autoComplete="name" maxLength={80} required /></label>
        <label>{t("au.reg.timeZone")}<select name="timeZone" defaultValue="Asia/Colombo"><option value="Asia/Colombo">Sri Lanka · Asia/Colombo</option><option value="UTC">Coordinated Universal Time · UTC</option><option value="Asia/Kolkata">India · Asia/Kolkata</option><option value="Asia/Dubai">UAE · Asia/Dubai</option><option value="Europe/London">UK · Europe/London</option></select></label>
        <p className="fw-auth-note">{t("au.reg.profilePrivate")}</p>
      </>}
      <button className="fw-primary" disabled={busy}>{busy ? t("au.reg.wait") : step === "register" ? t("au.reg.submitRegister") : step === "confirm" ? t("au.reg.submitConfirm") : t("au.reg.submitProfile")}</button>
    </form>}
    {["sent", "confirm"].includes(step) && <details className="fw-auth-resend" open={step === "sent"}>
      <summary>{t("au.reg.anotherEmail")}</summary>
      <form onSubmit={event => void resend(event)} aria-busy={busy}>
        <label>{t("au.email")}<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" maxLength={254} required /></label>
        <button className="fw-secondary" disabled={busy || remaining > 0}>{busy ? t("au.reg.requesting") : remaining > 0 ? t("au.reg.resendIn", { seconds: remaining }) : t("au.reg.resend")}</button>
        <p>{t("au.reg.resendNote")}</p>
      </form>
    </details>}
    {message && <p role="status" className="fw-auth-note">{message}</p>}
    {error && <p id="registration-error" role="alert" className="fw-auth-note">{error}</p>}
    <p><AuthLink href="/sign-in">{t("au.backToSignIn")}</AuthLink></p>
  </div>;
}
