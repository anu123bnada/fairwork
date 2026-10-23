import Image from "next/image";
import type { ReactNode } from "react";
import "./auth.css";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/brand";

export function AuthShell({ title, children, signIn = false }: { title: string; children: ReactNode; signIn?: boolean }) {
  return <main className={`fw-auth${signIn ? " fw-sign-in" : ""}`} id="main" tabIndex={-1}>
    {signIn && <a className="fw-auth-skip" href="#main">Skip to content</a>}
    <div className="fw-auth-status" aria-hidden="true"><span>9:41</span><svg width="52" height="16" viewBox="0 0 52 16" fill="currentColor"><path d="M0 8h3v6H0zM5 6h3v8H5zM10 4h3v10h-3zM15 2h3v12h-3z"/><rect x="24" y="1" width="24" height="13" rx="4" fill="none" stroke="currentColor"/><rect x="27" y="4" width="18" height="7" rx="1"/><path d="M50 5h2v5h-2z"/></svg></div>
    <BrandLogo className="oq-brand-auth" existing={<div className="fw-auth-brand" aria-hidden="true">
      <Image src="/figma/auth/logo-glass.svg" width={113} height={113} alt="" unoptimized />
      <Image className="fw-auth-shield" src="/figma/auth/shield.svg" width={34.86} height={43.26} alt="" unoptimized />
    </div>} />
    <h1>{title}</h1>{children}{!signIn && <p><Link className="oq-build-link" href="/about">About this build and privacy</Link></p>}
  </main>;
}
