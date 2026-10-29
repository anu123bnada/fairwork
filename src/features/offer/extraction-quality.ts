// A cheap, honest quality check on text read from a file or image. It cannot prove the text is right; it only flags the signs of a poor read
// so the person corrects the text before it is analysed. Thresholds are deliberately plain and are covered by tests.
export type QualityLevel = "good" | "check" | "poor";
export type QualityReason = "short" | "symbols" | "replacement" | "fragments" | "mixed_tokens" | "ocr" | "truncated";
export type ExtractionQuality = { level: QualityLevel; reasons: QualityReason[]; characters: number; words: number };

export function assessExtractionQuality(text: string, options: { source: "ocr" | "pdf" | "docx" | "paste"; truncated?: boolean }): ExtractionQuality {
  const body = text.replace(/\[Page \d+\]/g, " ");
  const characters = body.trim().length;
  const words = body.split(/\s+/).filter(Boolean);
  const reasons: QualityReason[] = [];
  let level: QualityLevel = "good";
  const raise = (to: QualityLevel) => { if (to === "poor" || level === "good") level = to; };
  if (characters < 40 || words.length < 8) { reasons.push("short"); raise("poor"); }
  const plain = (body.match(/[\p{L}\p{N}\s.,:;!?'"()%/$€£&@+\-–—]/gu) ?? []).length;
  if (body.length > 0 && plain / body.length < 0.85) { reasons.push("symbols"); raise("poor"); }
  if (body.includes("�")) { reasons.push("replacement"); raise("poor"); }
  const single = words.filter(word => word.length === 1 && !/[aAI0-9&@]/.test(word)).length;
  if (words.length >= 8 && single / words.length > 0.2) { reasons.push("fragments"); raise("check"); }
  // Letters and digits fused inside one token (for example "l0ve" or "5alary") are typical of a misread.
  const mixed = words.filter(word => /^\p{L}+\d+\p{L}+$|^\d+\p{L}{3,}$/u.test(word.replace(/[^\p{L}\d]/gu, "")) && !/^\d+(?:st|nd|rd|th|am|pm|hrs?|k|kg|mm|cm|km|x)$/i.test(word.replace(/[^\p{L}\d]/gu, ""))).length;
  if (words.length >= 8 && mixed / words.length > 0.08) { reasons.push("mixed_tokens"); raise("check"); }
  if (options.source === "ocr") { reasons.push("ocr"); raise("check"); }
  if (options.truncated) { reasons.push("truncated"); raise("check"); }
  return { level, reasons, characters, words: words.length };
}
