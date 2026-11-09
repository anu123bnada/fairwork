import { extractOfferTermsRuleBased } from "@/features/offer/deterministic-extractor";
import { analyzeClauses } from "@/features/offer/clause-analysis";
import { assessExtractionQuality, type QualityLevel } from "@/features/offer/extraction-quality";

// The offer scan: the stages shown on the scanning screen and the numbers in the report. Every stage state is set by real work finishing (an image check, the on-device reader,
// the rules, a real request that asks whether AI is configured). Nothing here invents progress, and nothing is sent anywhere.
export type ScanStageId = "image" | "read" | "quality" | "rules" | "ai";
export type ScanStageState = "pending" | "active" | "done" | "skipped" | "failed";
export type ScanStage = { id: ScanStageId; state: ScanStageState; detail: string };
export const scanStageOrder: readonly ScanStageId[] = ["image", "read", "quality", "rules", "ai"];
export const newScanStages = (): ScanStage[] => scanStageOrder.map(id => ({ id, state: "pending", detail: "" }));
export function updateScanStage(stages: ScanStage[], id: ScanStageId, state: ScanStageState, detail = ""): ScanStage[] {
  return stages.map(stage => stage.id === id ? { id, state, detail } : stage);
}
export const scanFinished = (stages: ScanStage[]) => stages.every(stage => stage.state === "done" || stage.state === "skipped");
export const scanFailed = (stages: ScanStage[]) => stages.some(stage => stage.state === "failed");

export const SCAN_TEXT_LIMIT = 10000;
export type ScanSummary = {
  characters: number; quality: QualityLevel; warningHigh: number; warningMedium: number; warningLow: number;
  clauseFindings: number; missingDetails: number; termsFound: string[];
};
// Counts come from the same rules the findings below the summary use, so the summary can never disagree with the report.
export function summarizeScan(text: string, options: { source?: "ocr" | "paste"; truncated?: boolean } = {}): ScanSummary {
  const { data, detectedTerms } = extractOfferTermsRuleBased(text);
  const quality = assessExtractionQuality(text, { source: options.source ?? "ocr", truncated: options.truncated });
  return {
    characters: quality.characters, quality: quality.level,
    warningHigh: data.warningSigns.filter(item => item.severity === "high").length,
    warningMedium: data.warningSigns.filter(item => item.severity === "medium").length,
    warningLow: data.warningSigns.filter(item => item.severity === "low").length,
    clauseFindings: analyzeClauses(text, { missing: true }).findings.length,
    missingDetails: data.missingDetails.length,
    termsFound: Object.keys(detectedTerms),
  };
}
