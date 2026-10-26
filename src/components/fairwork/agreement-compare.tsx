"use client";
import { useState } from "react";
import { changedTerms, diffTerms } from "@/features/offer/version-diff";
import type { AgreementVersion } from "@/features/offer/workflow-schema";
import type { MessageKey } from "@/i18n";
import { useI18n } from "@/i18n/use-i18n";

const label = (field: string) => field.replaceAll("_", " ").replaceAll(".", " ");

// Two saved versions of the same agreement next to each other. Read-only: it shows what changed and records nothing.
export function AgreementCompare({ versions }: { versions: readonly AgreementVersion[] }) {
  const { t } = useI18n();
  const ordered = [...versions].sort((a, b) => a.version - b.version);
  const [left, setLeft] = useState(ordered.length > 1 ? ordered[ordered.length - 2]!.version : 0), [right, setRight] = useState(ordered.at(-1)?.version ?? 0), [onlyChanges, setOnlyChanges] = useState(true);
  if (ordered.length < 2) return null;
  const a = ordered.find(version => version.version === left), b = ordered.find(version => version.version === right);
  const rows = a && b ? diffTerms(a.content.terms, b.content.terms) : [];
  const shown = onlyChanges ? changedTerms(rows) : rows;
  const show = (value: unknown) => value === undefined ? "—" : value === null ? t("ag.unresolvedValue") : String(value);
  return <details className="fw-card fw-offer-detail-card">
    <summary>{t("agc.title")}</summary>
    <p>{t("agc.intro")}</p>
    <label className="fw-field">{t("agc.left")}<select value={left} onChange={event => setLeft(Number(event.target.value))}>{ordered.map(version => <option key={version.version} value={version.version}>{t("agc.version", { version: version.version })}</option>)}</select></label>
    <label className="fw-field">{t("agc.right")}<select value={right} onChange={event => setRight(Number(event.target.value))}>{ordered.map(version => <option key={version.version} value={version.version}>{t("agc.version", { version: version.version })}</option>)}</select></label>
    <label className="fw-check"><input type="checkbox" checked={onlyChanges} onChange={event => setOnlyChanges(event.target.checked)} /> {t("agc.onlyChanges")}</label>
    {left === right && <p>{t("agc.same")}</p>}
    {left !== right && shown.length === 0 && <p>{t("agc.noChanges")}</p>}
    {left !== right && shown.length > 0 && <div className="fw-table-scroll"><table>
      <caption>{t("agc.caption", { left, right })}</caption>
      <thead><tr><th scope="col">{t("agc.field")}</th><th scope="col">{t("agc.version", { version: left })}</th><th scope="col">{t("agc.version", { version: right })}</th><th scope="col">{t("agc.change")}</th></tr></thead>
      <tbody>{shown.map(row => <tr key={row.field}><th scope="row">{label(row.field)}</th><td>{show(row.before)}</td><td>{show(row.after)}</td><td>{t(`agc.c.${row.change}` as MessageKey)}</td></tr>)}</tbody>
    </table></div>}
  </details>;
}

