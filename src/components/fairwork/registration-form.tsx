"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { appRequest } from "@/features/authority/client";
import { participantDestination } from "@/features/offer/participant-path";

export function RegistrationForm({ confirmation = false, profile = false }: { confirmation?: boolean; profile?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(profile ? "profile" : confirmation ? "confirm" : "register");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [profileKey] = useState(() => crypto.randomUUID());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      if (step === "register") {
        await appRequest("/api/v1/auth/register", { email: form.get("email"), password: form.get("password") });
        setStep("sent");
      } else if (step === "confirm") {
        // The configured email template puts the bearer hash in the fragment:
        // it never reaches server URL logs or referrers. Explicit POST avoids
        // consuming it on link preview/prefetch. Remove it after verification.
        const tokenHash = new URLSearchParams(window.location.hash.slice(1)).get("token_hash")
          ?? new URLSearchParams(window.location.search).get("token_hash");
        await appRequest("/api/v1/auth/confirm", { tokenHash });
        window.history.replaceState(null, "", "/auth/confirm");
        router.replace("/register/profile");
      } else {
        await appRequest("/api/v1/me", { displayName: form.get("displayName"), locale: "en", timeZone: "Asia/Colombo" }, profileKey);
        router.replace(participantDestination(window.location.search) ?? "/app/intro-welcome"); router.refresh();
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to continue."); }
    finally { setBusy(false); }
  }
  if (step === "sent") return <p role="status">If registration is available for this address, check your email for a confirmation link. Existing accounts can sign in.</p>;
  return <form onSubmit={event => void submit(event)}>
    {step === "register" && <><label>Email address<input type="email" name="email" autoComplete="username" required maxLength={254} /></label><label>Password<input type="password" name="password" autoComplete="new-password" minLength={12} maxLength={128} required /></label></>}
    {step === "confirm" && <p>Confirm the email address you registered. This starts your authenticated session; it grants no employer or operator authority.</p>}
    {step === "profile" && <label>Display name<input name="displayName" maxLength={80} required /></label>}
    <button className="fw-primary" disabled={busy}>{busy ? "Please wait…" : step === "register" ? "Register with email" : step === "confirm" ? "Confirm my email" : "Create my profile"}</button>
    {error && <p role="alert">{error}</p>}
  </form>;
}
