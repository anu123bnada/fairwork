"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { participantDestination } from "@/features/offer/participant-path";

export function AuthInformationLink() {
  const router = useRouter();
  return <Link href="/sign-in/information" onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    // Carry only an already-validated record identifier, never credentials or an
    // arbitrary redirect. Information is public; the eventual read still authorizes.
    const destination = participantDestination(window.location.search);
    const query = new URLSearchParams(destination?.split("?")[1]);
    const path = window.location.pathname;
    query.set("from", path === "/welcome" ? "welcome" : path === "/otp" ? "otp" : "sign-in");
    router.push(`/sign-in/information?${query}`);
  }}>Sign-in information</Link>;
}
