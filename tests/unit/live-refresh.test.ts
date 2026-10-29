import { describe, expect, it } from "vitest";
import { LIVE_BASE_MS, LIVE_MAX_MS, nextRefreshDelay } from "@/features/live/refresh-schedule";

describe("live refresh schedule", () => {
  it("repeats on the base interval while healthy and backs off with a ceiling after failures", () => {
    expect(nextRefreshDelay(0)).toBe(LIVE_BASE_MS);
    expect(nextRefreshDelay(1)).toBe(LIVE_BASE_MS * 2);
    expect(nextRefreshDelay(3)).toBe(LIVE_BASE_MS * 8 > LIVE_MAX_MS ? LIVE_MAX_MS : LIVE_BASE_MS * 8);
    expect(nextRefreshDelay(50)).toBe(LIVE_MAX_MS);
    expect(nextRefreshDelay(-4)).toBe(LIVE_BASE_MS);
  });
});
