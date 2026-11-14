"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { companyResultsSchema } from "@/features/authority/company-schema";
import { offerListSchema } from "@/features/offer/list-schema";
import { dashboard } from "@/features/applications/schema";
import { useI18n } from "@/i18n/use-i18n";

// Three figures for the employer overview, each read from an endpoint the screen already uses: organizations you are authorized for, offers you manage, and
// applications on your listings. Nothing is estimated; a read that fails shows a dash and says so.
type Figure = { state: "loading" } | { state: "failed" } | { state: "ready"; value: string; note: string };

export function EmployerKpis() {
  const { t } = useI18n();
  const [orgs, setOrgs] = useState<Figure>({ state: "loading" });
  const [offers, setOffers] = useState<Figure>({ state: "loading" });
  const [apps, setApps] = useState<Figure>({ state: "loading" });
  useEffect(() => {
    let live = true;
    const run = (load: () => Promise<Figure>, set: (value: Figure) => void) => { load().then(value => { if (live) set(value); }).catch(() => { if (live) set({ state: "failed" }); }); };
    run(async () => { const list = companyResultsSchema.parse(await appRequest("/api/v1/companies")).items; return { state: "ready", value: String(list.length), note: list.length ? t("v2.emp.orgsNote") : t("v2.emp.orgsNone") }; }, setOrgs);
    run(async () => { const page = offerListSchema.parse(await appRequest("/api/v1/offers?context=EMPLOYER&view=active")); return { state: "ready", value: `${page.items.length}${page.nextCursor ? "+" : ""}`, note: page.items.length ? t("v2.emp.offersNote") : t("v2.emp.offersNone") }; }, setOffers);
    run(async () => {
      const board = dashboard.parse(await appRequest("/api/v1/applications?view=dashboard"));
      const live = board.items.filter(item => item.status === "published").length;
      const total = board.items.reduce((sum, item) => sum + item.counts.submitted + item.counts.reviewing + item.counts.shortlisted + item.counts.declined, 0);
      return { state: "ready", value: String(total), note: board.items.length ? t("v2.emp.appsNote", { live, listings: board.items.length }) : t("v2.emp.appsNone") };
    }, setApps);
    return () => { live = false; };
  }, [t]);
  const tiles: readonly [string, string, Figure, string, string][] = [
    [t("v2.emp.orgs"), "ek-orgs", orgs, "/app/employer#org", t("v2.emp.orgsLink")],
    [t("v2.emp.offers"), "ek-offers", offers, "/app/add-offer", t("v2.emp.offersLink")],
    [t("v2.emp.apps"), "ek-apps", apps, "/app/applicants", t("v2.emp.appsLink")],
  ];
  return <section className="oq-ek" aria-label={t("v2.emp.kpiAria")}>
    {tiles.map(([label, key, figure, href, link]) => <article key={key} className="oq-ek-tile" aria-busy={figure.state === "loading"}>
      <span className="oq-ek-label">{label}</span>
      {figure.state === "loading" ? <span className="oq-skel oq-ek-skel" /> : <strong className="oq-ek-value">{figure.state === "ready" ? figure.value : "—"}</strong>}
      <span className="oq-ek-note" role={figure.state === "failed" ? "status" : undefined}>{figure.state === "ready" ? figure.note : figure.state === "failed" ? t("dash.unavailable") : " "}</span>
      <Link href={href}>{link} →</Link>
    </article>)}
  </section>;
}
