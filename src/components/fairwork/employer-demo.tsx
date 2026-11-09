"use client";
import { useMemo, useState } from "react";
import { sampleEmployers } from "@/features/employers/sample-data";
import { useI18n } from "@/i18n/use-i18n";
import "./records.css";

// Employer intelligence DEMO. Three kinds of information are kept in separate panels and never mixed: SAMPLE information (invented for the demo), information submitted by users
// (none in this demo) and verified facts (none: a sample company can never be verified). To check a real company the person uses Company research, which shows its source and time.
export function EmployerDemo() {
  const { t } = useI18n();
  const [query, setQuery] = useState(""), [selected, setSelected] = useState(sampleEmployers[0]?.id ?? "");
  const list = useMemo(() => sampleEmployers.filter(item => `${item.name} ${item.sector} ${item.location} ${item.roles.join(" ")}`.toLowerCase().includes(query.trim().toLowerCase())), [query]);
  const employer = sampleEmployers.find(item => item.id === selected) ?? null;
  return <section className="oq-rec" aria-label={t("dmo.aria")}>
    <p className="fw-notice" role="note"><strong>{t("dmo.sampleLabel")}</strong> {t("dmo.sampleBody")}</p>
    <label className="fw-field">{t("dmo.search")}<input maxLength={60} value={query} onChange={e => setQuery(e.target.value)} /></label>
    {list.length === 0 && <p>{t("dmo.none")}</p>}
    <ul className="oq-rec-list" aria-label={t("dmo.listAria")}>{list.map(item => <li key={item.id}>
      <strong>{item.name}</strong> · {item.sector} · {item.location}
      <button className="fw-secondary" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>{t("dmo.view", { name: item.name })}</button>
    </li>)}</ul>
    {employer && <div aria-label={t("dmo.profileAria", { name: employer.name })}>
      <h3>{employer.name}</h3>
      <section className="oq-rec-group" aria-label={t("dmo.sampleSection")}>
        <h4>{t("dmo.sampleSection")}</h4>
        <p>{employer.about}</p>
        <p>{t("dmo.facts", { size: employer.size, founded: employer.founded, location: employer.location })}</p>
        <p>{t("dmo.roles")}: {employer.roles.join(", ")}</p>
        <ul>{employer.employmentInfo.map(row => <li key={row.label}><strong>{row.label}:</strong> {row.value}</li>)}</ul>
        <h5>{t("dmo.ask")}</h5>
        <ul>{employer.askThem.map(question => <li key={question}>{question}</li>)}</ul>
      </section>
      <section className="oq-rec-group" aria-label={t("dmo.userSection")}>
        <h4>{t("dmo.userSection")}</h4>
        <p>{t("dmo.userNone")}</p>
      </section>
      <section className="oq-rec-group" aria-label={t("dmo.verifiedSection")}>
        <h4>{t("dmo.verifiedSection")}</h4>
        <p><strong>{t("dmo.verifiedNone")}</strong> {t("dmo.verifiedWhy")}</p>
      </section>
    </div>}
    <p className="fw-notice">{t("dmo.notice")}</p>
  </section>;
}
