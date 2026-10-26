import type { Metadata } from "next";
import "@/components/fairwork/product.css";
import { AppBrandHeader } from "@/components/brand/brand";
import { CredentialVerifier } from "@/components/fairwork/credential-verifier";

export const metadata: Metadata = { title: "Verify an ORYQEN credential", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function VerifyPage() {
  return <main id="main" className="fw-verify"><AppBrandHeader /><CredentialVerifier /></main>;
}
