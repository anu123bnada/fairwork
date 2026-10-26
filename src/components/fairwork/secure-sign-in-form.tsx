"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { appRequest } from "@/features/authority/client";
import { participantDestination, participantAuthQuery } from "@/features/offer/participant-path";
import { AuthLink } from "./auth-link";
import { useI18n } from "@/i18n/use-i18n";

export function SecureSignInForm({ className }: { className?: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const result = await appRequest("/api/v1/auth/sign-in", {
        email: data.get("email"),
        password: data.get("password"),
      });
      const query = participantAuthQuery(window.location.search);
      router.replace(result.profileRequired === true
        ? `/register/profile${query ? `?${query}` : ""}`
        : participantDestination(window.location.search) ?? "/app/intro-welcome");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("au.signInFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={className} onSubmit={(event) => void submit(event)} aria-busy={busy}>
      <label>{t("au.email")}<input name="email" type="email" autoComplete="username" required maxLength={254} /></label>
      <label>{t("au.password")}<input name="password" type="password" autoComplete="current-password" required maxLength={128} /></label>
      <button className="fw-primary" disabled={busy}>{busy ? t("au.verifying") : t("au.continueSecurely")}</button>
      {error && <p role="alert">{error}</p>}
      <p><AuthLink href="/forgot-password">{t("au.forgot")}</AuthLink></p>
      {error && <p><AuthLink href="/auth/confirm">{t("au.needVerify")}</AuthLink></p>}
    </form>
  );
}
