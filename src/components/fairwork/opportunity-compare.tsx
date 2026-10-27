"use client";
import { useState } from "react";
import { COMPARE_MAX, compareListings, payComparable } from "@/features/opportunities/compare";
import type { Opportunity } from "@/features/opportunities/schema";
import type { MessageKey } from "@/i18n";
import { useI18n } from "@/i18n/use-i18n";

// Compares up to four of the listings the person has saved. Read-only: no ranking, no conversion, nothing is stored.
export function OpportunityCompare({ items }: { items: readonly Opportunity[] }) {
  const { t } = useI18n();
  const [chosen, setChosen] = useState<string[]>([]);
  if (items.length < 2) return null;
  const picked = items.filter(item => chosen.includes(item.id));
  const word = (prefix: string, value: string) => t(`${prefix}.${value}` as MessageKey);
  const rows = picked.length >= 2 ? compareListings(picked, pay => `${pay.amount} ${pay.currency} / ${word("op.pp", pay.period)}`, iso => new Date(iso).toLocaleDateString()) : [];
  const toggle = (id: string) => setChosen(previous => previous.includes(id) ? previous.filter(entry => entry !== id) : previous.length < COMPARE_MAX ? [...previous, id] : previous);
  return <details className="fw-list-card">
    <summary>{t("opc.title")}</summary>
    <p>{t("opc.intro", { max: COMPARE_MAX })}</p>
    <fieldset><legend>{t("opc.pick")}</legend>
      {items.map(item => <label className="fw-check" key={item.id}><input type="checkbox" checked={chosen.includes(item.id)} disabled={!chosen.includes(item.id) && chosen.length >= COMPARE_MAX} onChange={() => toggle(item.id)} /> {item.fields.title}{item.companyName ? ` · ${item.companyName}` : ""}</label>)}
    </fieldset>
    {picked.length < 2 && <p>{t("opc.needTwo")}</p>}
    {rows.length > 0 && <div className="fw-table-scroll"><table>
      <caption>{t("opc.caption")}</caption>
      <thead><tr><th scope="col">{t("opc.field")}</th>{picked.map(item => <th scope="col" key={item.id}>{item.fields.title}</th>)}</tr></thead>
      <tbody>{rows.map(row => <tr key={row.field}><th scope="row">{t(`opc.row.${row.field}` as MessageKey)}{row.differs ? ` · ${t("opc.differs")}` : ""}</th>{row.values.map((value, index) => <td key={picked[index]!.id}>{value === null ? (row.field === "pay" ? t("op.payNotStated") : "—") : row.field === "workMode" ? word("op.wm", value) : value}</td>)}</tr>)}</tbody>
    </table></div>}
    {rows.length > 0 && !payComparable(picked) && <p role="status">{t("opc.payNote")}</p>}
  </details>;
}
