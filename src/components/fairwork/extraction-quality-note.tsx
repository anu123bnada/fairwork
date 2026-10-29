"use client";
import { assessExtractionQuality, type ExtractionQuality } from "@/features/offer/extraction-quality";
import { useI18n } from "@/i18n/use-i18n";
import type { MessageKey } from "@/i18n";

// Shows how trustworthy a read looks, recomputed from the text as the person corrects it. It never says the text is correct.
export function ExtractionQualityNote({ text, source, truncated }: { text: string; source: "ocr" | "pdf" | "docx"; truncated?: boolean }) {
  const { t } = useI18n();
  const quality: ExtractionQuality = assessExtractionQuality(text, { source, truncated });
  return <div className={`fw-notice fw-quality fw-quality-${quality.level}`} role="status" aria-label={t("im.q.aria")}>
    <strong>{t(`im.q.${quality.level}` as MessageKey)}</strong>
    {quality.reasons.length > 0 && <ul>{quality.reasons.map(reason => <li key={reason}>{t(`im.q.r.${reason}` as MessageKey)}</li>)}</ul>}
    <small>{t("im.q.counts", { chars: quality.characters, words: quality.words })}</small>
  </div>;
}
