"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { appRequest } from "@/features/authority/client";
export function RecoveryForm({ confirm = false }: { confirm?: boolean }) {
  const [step, setStep] = useState(confirm ? "confirm" : "request");
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [factorId, setFactorId] = useState("");
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
        await appRequest("/api/v1/auth/recovery", { email: data.get("email") }); setStep("sent");
      } else if (step === "confirm") {
        const tokenHash = new URLSearchParams(window.location.hash.slice(1)).get("token_hash");
        await appRequest("/api/v1/auth/recovery/confirm", { tokenHash });
        window.history.replaceState(null, "", "/auth/recover");
        // The one-use link is consumed. Retry only the assurance lookup if it
        // fails; never expose password entry before that lookup succeeds.
        setStep("assurance");
        await checkAuthenticator();
      } else if (step === "assurance") {
        await checkAuthenticator();
      } else if (step === "mfa") {
        await appRequest("/api/v1/auth/mfa", { action: "verify", factorId, code: data.get("code") }); setStep("password");
      } else {
        if (data.get("password") !== data.get("confirmPassword")) throw new Error("The passwords do not match.");
        await appRequest("/api/v1/auth/password", { password: data.get("password") }); setStep("done");
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Recovery could not be completed."); }
    finally { setBusy(false); }
  }
  if (step === "sent") return <p role="status">If this address has an account, check its inbox for a recovery link. No account information is disclosed here.</p>;
  if (step === "done") return <><p role="status">Your password was changed. Sign in again with the new password.</p><Link className="fw-primary" href="/sign-in">Sign in</Link></>;
  return <form onSubmit={event => void submit(event)}>
    {step === "request" && <label>Email address<input name="email" type="email" autoComplete="username" required maxLength={254}/></label>}
    {step === "confirm" && <p>Continue only if you requested this password reset. Opening this page alone does not consume the recovery link.</p>}
    {step === "assurance" && <p>Your recovery link was confirmed. Check your account authenticator requirements to continue.</p>}
    {step === "mfa" && <><p>Your existing authenticator is still required. Email recovery does not remove MFA.</p><label>Authenticator code<input name="code" inputMode="numeric" pattern="[0-9]{6}" autoComplete="one-time-code" required/></label><p>Lost authenticator access requires an independently reviewed recovery process; this application cannot bypass it.</p></>}
    {step === "password" && <><label>New password<input name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><label>Confirm new password<input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/></label><p>Changing your password signs out refresh sessions on all devices. Existing access tokens expire on the configured provider schedule.</p></>}
    {error && <p role="alert">{error}</p>}
    <button className="fw-primary" disabled={busy}>{busy ? "Please wait…" : step === "request" ? "Send recovery email" : step === "confirm" ? "Confirm recovery link" : step === "assurance" ? "Retry authenticator check" : step === "mfa" ? "Verify authenticator" : "Save new password"}</button>
  </form>;
}
