"use client";
import Image from "next/image";
import type { ReactNode } from "react";
import "./auth.css";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand";
import { useI18n } from "@/i18n/use-i18n";

export function AuthShell({ title, children, signIn = false }: { title: string; children: ReactNode; signIn?: boolean }) {
  const { t } = useI18n();
  return <main className={`fw-auth${signIn ? " fw-sign-in" : ""}`} id="main" tabIndex={-1}>
    {signIn && <a className="fw-auth-skip" href="#main">{t("au.skip")}</a>}
    <aside className="fw-auth-aside" aria-label={t("au.welcomeAria")}>
      <span className="fw-auth-eyebrow">{t("au.eyebrow1")}</span>
      <div><span className="fw-auth-eyebrow">{t("au.eyebrow2")}</span><h2>{t("au.headline")}</h2><p>{t("au.asideText")}</p></div>
      <p className="fw-auth-aside-footer">{t("au.asideFooter")}</p>
    </aside>
    <div className="fw-auth-main"><div className="fw-auth-content">
    <BrandLogo className="oq-brand-auth" existing={<div className="fw-auth-brand" aria-hidden="true">
      <Image src="/figma/auth/logo-glass.svg" width={113} height={113} alt="" loading="eager" unoptimized />
      <Image className="fw-auth-shield" src="/figma/auth/shield.svg" width={34.86} height={43.26} alt="" unoptimized />
    </div>} />
    <h1>{title}</h1>{children}{!signIn && <p><Link className="oq-build-link" href="/about">{t("au.aboutBuild")}</Link></p>}
    </div></div>
  </main>;
}
