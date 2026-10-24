import Image from "next/image";
import type { ReactNode } from "react";
import "./auth.css";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand";

export function AuthShell({ title, children, signIn = false }: { title: string; children: ReactNode; signIn?: boolean }) {
  return <main className={`fw-auth${signIn ? " fw-sign-in" : ""}`} id="main" tabIndex={-1}>
    {signIn && <a className="fw-auth-skip" href="#main">Skip to content</a>}
    <aside className="fw-auth-aside" aria-label="Welcome to ORYQEN">
      <span className="fw-auth-eyebrow">Your work, understood</span>
      <div><span className="fw-auth-eyebrow">Clarity at every step</span><h2>Better work starts with understanding.</h2><p>A shared place to understand work terms, keep a clear record, and move forward with confidence.</p></div>
      <p className="fw-auth-aside-footer">Clear terms. Shared understanding.</p>
    </aside>
    <div className="fw-auth-main"><div className="fw-auth-content">
    <BrandLogo className="oq-brand-auth" existing={<div className="fw-auth-brand" aria-hidden="true">
      <Image src="/figma/auth/logo-glass.svg" width={113} height={113} alt="" loading="eager" unoptimized />
      <Image className="fw-auth-shield" src="/figma/auth/shield.svg" width={34.86} height={43.26} alt="" unoptimized />
    </div>} />
    <h1>{title}</h1>{children}{!signIn && <p><Link className="oq-build-link" href="/about">About this build and privacy</Link></p>}
    </div></div>
  </main>;
}
