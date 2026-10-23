"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { appRequest } from "@/features/authority/client";
import { participantDestination } from "@/features/offer/participant-path";
import Link from "next/link";

export function SecureSignInForm({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      await appRequest("/api/v1/auth/sign-in", {
        email: data.get("email"),
        password: data.get("password"),
      });
      router.replace(participantDestination(window.location.search) ?? "/app/intro-welcome");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={className} onSubmit={(event) => void submit(event)}>
      <label>Email address<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>
      <button className="fw-primary" disabled={busy}>{busy ? "Verifying account…" : "Continue securely"}</button>
      {error && <p role="alert">{error}</p>}
      <p><Link href="/forgot-password">Forgot your password?</Link></p>
    </form>
  );
}
