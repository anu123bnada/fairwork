import { describe, expect, it } from "vitest";
import { newScanStages, scanFailed, scanFinished, scanStageOrder, summarizeScan, updateScanStage } from "@/features/scan/report";

describe("scan stages", () => {
  it("start all pending, in a fixed order, and update without mutating", () => {
    const first = newScanStages();
    expect(first.map(stage => stage.id)).toEqual([...scanStageOrder]);
    expect(first.every(stage => stage.state === "pending")).toBe(true);
    const second = updateScanStage(first, "read", "active", "Reading");
    expect(first.find(stage => stage.id === "read")!.state).toBe("pending");
    expect(second.find(stage => stage.id === "read")).toEqual({ id: "read", state: "active", detail: "Reading" });
    expect(second.filter(stage => stage.state === "pending")).toHaveLength(4);
  });

  it("is finished only when every stage is done or skipped, and failed when any stage failed", () => {
    let stages = newScanStages();
    for (const id of scanStageOrder.slice(0, 4)) stages = updateScanStage(stages, id, "done");
    expect(scanFinished(stages)).toBe(false);
    stages = updateScanStage(stages, "ai", "skipped", "AI is not configured");
    expect(scanFinished(stages)).toBe(true);
    expect(scanFailed(stages)).toBe(false);
    expect(scanFailed(updateScanStage(stages, "quality", "failed", "x"))).toBe(true);
    expect(scanFinished(updateScanStage(stages, "quality", "failed", "x"))).toBe(false);
  });
});

describe("scan summary", () => {
  it("counts findings from the same rules as the report and lists the terms it found", () => {
    const text = "Role: Technician\nSalary: LKR 85000 per month\n40 hours per week\nYou must pay a registration fee of LKR 5000 before you start. Guaranteed visa for everyone.";
    const summary = summarizeScan(text);
    expect(summary.characters).toBe(text.length);
    expect(summary.termsFound).toEqual(expect.arrayContaining(["role"]));
    expect(summary.warningHigh + summary.warningMedium + summary.warningLow).toBeGreaterThan(0);
    expect(summary.quality).toMatch(/good|check|poor/);
  });

  it("reports an unreadable read as poor and finds no invented terms", () => {
    const summary = summarizeScan("0 HOO DOO §3 F628 = 55560/65!\n08m 36 DO Mendes 28 = 8D 590) OF");
    expect(summary.quality).not.toBe("good");
    expect(summary.warningHigh).toBe(0);
  });

  it("never throws on empty input", () => {
    const summary = summarizeScan("");
    expect(summary.characters).toBe(0);
    expect(summary.termsFound).toEqual([]);
  });
});
