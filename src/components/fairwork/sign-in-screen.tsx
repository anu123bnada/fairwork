"use client";
import Link from "next/link";
import { AuthShell } from "./auth-shell";
import { SecureSignInForm } from "./secure-sign-in-form";
import { AuthInformationLink } from "./auth-information-link";
import "./auth-composition.css";
import { AuthLink } from "./auth-link";
import { useI18n } from "@/i18n/use-i18n";

export function SignInScreen() {
  const { t } = useI18n();
  return <AuthShell title={t("au.signInTitle")} signIn>
    <Link className="fw-sign-in-back" href="/intro/language" aria-label={t("au.backLanguage")}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
    </Link>
    <p className="fw-auth-subtitle">{t("au.signInSubtitle")}</p>
    <nav className="fw-auth-tabs" aria-label={t("au.accountAccess")}><span aria-current="page">{t("au.signIn")}</span><AuthLink href="/register">{t("au.createAccount")}</AuthLink></nav>
    <SecureSignInForm />
    <div className="fw-sign-in-information">
      <p className="fw-sign-in-notice">{t("au.testOnly")}</p>
      <AuthInformationLink />
    </div>
    <p className="fw-sign-in-employer"><Link href="/app/employer">{t("au.employerLink")}</Link></p>
  </AuthShell>;
}
