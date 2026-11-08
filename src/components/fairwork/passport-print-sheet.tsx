"use client";
import { useI18n } from "@/i18n/use-i18n";
import type { collectPrivatePassportExport } from "@/features/work/passport-export";

type PassportFile = Awaited<ReturnType<typeof collectPrivatePassportExport>>;

// A print-only sheet built from the same re-authorized export as the JSON download. Browsers save it as a PDF from the print dialog.
// It is a private personal copy: it is not signed, carries no live verification link, and cannot be revoked once printed.
export function PassportPrintSheet({ file, name }: { file: PassportFile; name: string }) {
  const { t } = useI18n();
  return <section className="oq-print-sheet" aria-label={t("pp.print.aria")}>
    <h1>{t("pp.print.title")}</h1>
    <p><strong>{name}</strong></p>
    <p>{t("pp.print.generated", { date: new Date(file.exportedAt).toLocaleString() })}</p>
    <p>{file.notice}</p>
    <table>
      <thead><tr><th>{t("pp.print.role")}</th><th>{t("pp.print.company")}</th><th>{t("pp.print.period")}</th><th>{t("pp.print.hours")}</th><th>{t("pp.print.verified")}</th></tr></thead>
      <tbody>{file.records.map(record => <tr key={`${record.revision}-${record.role}-${record.periodStart}-${record.verifiedAt}`}>
        <td>{record.role}<br />{record.summary}</td><td>{record.companyName}</td>
        <td>{record.periodStart} – {record.periodEnd}</td><td>{record.hours}</td><td>{new Date(record.verifiedAt).toLocaleDateString()}</td>
      </tr>)}</tbody>
    </table>
    <p>{t("pp.print.footer")}</p>
  </section>;
}
