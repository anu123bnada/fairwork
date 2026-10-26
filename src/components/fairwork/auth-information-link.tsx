"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { participantAuthQuery } from "@/features/offer/participant-path";
import { useI18n } from "@/i18n/use-i18n";

export function AuthInformationLink() {
  const router = useRouter();
  const { t } = useI18n();
  return <Link href="/sign-in/information" onClick={event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    // Carry only an already-validated record identifier, never credentials or an
    // arbitrary redirect. Information is public; the eventual read still authorizes.
    const query = new URLSearchParams(participantAuthQuery(window.location.search));
    const path = window.location.pathname;
    query.set("from", path === "/welcome" ? "welcome" : path === "/otp" ? "otp" : "sign-in");
    router.push(`/sign-in/information?${query}`);
  }}>{t("au.signInInfo")}</Link>;
}
