"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { appRequest, ApiRequestError } from "@/features/authority/client";
import { participantDestination, participantAuthQuery } from "@/features/offer/participant-path";
import { authPath } from "@/features/identity/auth-navigation";
import { AuthLink } from "./auth-link";
import { createVerificationStore } from "./verification-store";

export function RegistrationForm({ confirmation = false, profile = false, displayName = "" }: { confirmation?: boolean; profile?: boolean; displayName?: string }) {
  const router = useRouter();
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
    if (Date.now() < retryAt) { setError("Please wait a minute before requesting another email."); return; }
    setBusy(true);
    try {
      await appRequest("/api/v1/auth/resend", { email, continuation: participantAuthQuery(window.location.search) });
      beginCooldown();
      setMessage("If this address has an unconfirmed account, a new verification email has been requested. Check your inbox and spam folder.");
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.code === "RATE_LIMITED") beginCooldown();
      setError(caught instanceof Error ? caught.message : "Unable to request another email.");
    }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const element = event.currentTarget;
    const form = new FormData(element);
    try {
      if (step === "register") {
        if (form.get("password") !== form.get("confirmPassword")) {
          (element.elements.namedItem("confirmPassword") as HTMLInputElement).focus();
          throw new Error("The passwords do not match. Check both password fields.");
        }
        const name = String(form.get("displayName") ?? "").trim();
        if (!name) throw new Error("Enter your name to continue.");
        await appRequest("/api/v1/auth/register", { email, password: form.get("password"), displayName: name, continuation: participantAuthQuery(window.location.search) });
        beginCooldown(); setStep("sent");
      } else if (step === "confirm") {
        const current = verification.getSnapshot();
        if (!current || !["ready", "session"].includes(current.kind)) throw new Error("Open the verification link in your email, or request a new link below.");
        const credentials = current.kind === "ready" ? { tokenHash: current.tokenHash }
          : current.kind === "session" ? { accessToken: current.accessToken, refreshToken: current.refreshToken } : null;
        const result = await appRequest("/api/v1/auth/confirm", credentials);
        if (result?.confirmed !== true) throw new Error("Unable to establish your session. Please sign in or request a new email.");
        verification.clear();
        const query = participantAuthQuery(window.location.search);
        window.history.replaceState(null, "", authPath("/auth/confirm", query));
        router.replace(authPath("/register/profile", query)); router.refresh();
      } else {
        const name = String(form.get("displayName") ?? "").trim();
        if (!name) throw new Error("Enter a display name to continue.");
        await appRequest("/api/v1/me", { displayName: name, locale: "en", timeZone: form.get("timeZone") }, profileKey);
        router.replace(participantDestination(window.location.search) ?? "/app/intro-welcome"); router.refresh();
      }
    } catch (caught) {
      if (step === "confirm" && caught instanceof ApiRequestError && caught.code === "AUTH_REQUIRED") verification.clear();
      setError(step === "confirm" && caught instanceof ApiRequestError && caught.code === "AUTH_REQUIRED"
        ? "This verification link is invalid or has expired. Request another email below, or sign in if you already confirmed your address."
        : caught instanceof Error ? caught.message : "Unable to continue.");
    }
    finally { setBusy(false); }
  }
  return <div className="fw-auth-flow">
    <ol className="fw-auth-steps" aria-label="Account setup progress">
      {["Account", "Verify email", "Your profile"].map((label, index) => <li key={label} aria-current={(step === "profile" ? 2 : ["sent", "confirm"].includes(step) ? 1 : 0) === index ? "step" : undefined}><span>{index + 1}</span>{label}</li>)}
    </ol>
    {step === "choose" ? <section className="fw-account-choices" aria-label="Choose your account">
      <h2>How will you use ORYQEN?</h2><p>Choose where to start. You can switch workspaces later.</p>
      <button type="button" onClick={() => choose("worker")}><span className="fw-choice-icon" aria-hidden="true">01</span><span><strong>I’m a worker</strong><small>Understand offers and keep your work record.</small></span><span aria-hidden="true">→</span></button>
      <button type="button" onClick={() => choose("employer")}><span className="fw-choice-icon" aria-hidden="true">02</span><span><strong>I’m an employer</strong><small>Represent an organization and clarify work terms.</small></span><span aria-hidden="true">→</span></button>
      <p className="fw-auth-note">Employer authority requires a separate reviewed company membership. Choosing an account does not grant approval.</p>
    </section> : step === "sent" ? <section className="fw-auth-result">
      <span className="fw-result-icon" aria-hidden="true">✉</span><h2>Check your inbox</h2>
      <p role="status">If registration is available for this address, check your email for a confirmation link. Existing accounts can sign in.</p>
      <p>Open the link, confirm your email, then finish your profile. Check spam if it hasn’t arrived.</p>
    </section> : step === "confirm" && context?.kind !== "ready" && context?.kind !== "session" ? <section className="fw-auth-result">
      <span className="fw-result-icon" aria-hidden="true">✉</span>
      <h2>{!context ? "Checking your link…" : context.kind === "missing" ? "Open your verification email" : context.kind === "expired" ? "This link has expired" : "This link cannot be used"}</h2>
      <p>{!context ? "Please wait while we check the link format." : "Use the latest confirmation link from your inbox. If it is missing or no longer works, request a new email below. Already confirmed? Sign in to continue."}</p>
    </section> : <form onSubmit={event => void submit(event)} aria-busy={busy}>
      {step === "register" && <>
        <div className="fw-auth-selection"><strong>{account === "employer" ? "Employer" : "Worker"} account</strong><button type="button" onClick={() => setStep("choose")} disabled={busy}>Change</button></div>
        <label>Your name<input name="displayName" autoComplete="name" maxLength={80} required /></label>
        <label>Email address<input type="email" name="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required maxLength={254} /></label>
        <label>Password<input type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128} aria-describedby="registration-password-help" required /></label>
        <p id="registration-password-help" className="fw-field-help">Use 12–128 characters. A long, unique passphrase works well.</p>
        <label>Confirm password<input type="password" name="confirmPassword" autoComplete="new-password" minLength={12} maxLength={128} aria-invalid={error.startsWith("The passwords") || undefined} aria-describedby={error.startsWith("The passwords") ? "registration-error" : undefined} required /></label>
      </>}
      {step === "confirm" && <p>{context?.kind === "session" ? "Your email link has returned from Supabase. Continue to validate your session and set up your private profile." : "Confirm your email to continue to your private profile."} Only continue if you requested this account.</p>}
      {step === "profile" && <>
        <p>Choose how your name appears to work participants. You can update it in Settings.</p>
        <label>Display name<input name="displayName" defaultValue={displayName} autoComplete="name" maxLength={80} required /></label>
        <label>Time zone<select name="timeZone" defaultValue="Asia/Colombo"><option value="Asia/Colombo">Sri Lanka · Asia/Colombo</option><option value="UTC">Coordinated Universal Time · UTC</option><option value="Asia/Kolkata">India · Asia/Kolkata</option><option value="Asia/Dubai">UAE · Asia/Dubai</option><option value="Europe/London">UK · Europe/London</option></select></label>
        <p className="fw-auth-note">Your profile is private by default. Organization membership is reviewed separately.</p>
      </>}
      <button className="fw-primary" disabled={busy}>{busy ? "Please wait…" : step === "register" ? "Register with email" : step === "confirm" ? "Confirm my email" : "Create my profile"}</button>
    </form>}
    {["sent", "confirm"].includes(step) && <details className="fw-auth-resend" open={step === "sent"}>
      <summary>Need another verification email?</summary>
      <form onSubmit={event => void resend(event)} aria-busy={busy}>
        <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" maxLength={254} required /></label>
        <button className="fw-secondary" disabled={busy || remaining > 0}>{busy ? "Requesting email…" : remaining > 0 ? `Resend available in ${remaining}s` : "Resend verification email"}</button>
        <p>Wait at least one minute between requests. Email delivery may take a few minutes.</p>
      </form>
    </details>}
    {message && <p role="status" className="fw-auth-note">{message}</p>}
    {error && <p id="registration-error" role="alert" className="fw-auth-note">{error}</p>}
    <p><AuthLink href="/sign-in">Back to sign in</AuthLink></p>
  </div>;
}
