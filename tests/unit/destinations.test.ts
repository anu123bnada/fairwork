import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { destinations, searchDestinations, type RankedDestination } from "@/features/navigation/destinations";
import { translate } from "@/i18n";

const ranked: RankedDestination[] = destinations.map(item => ({ ...item, text: translate("en", item.label) }));

describe("command palette destinations", () => {
  it("lists only screens the app actually serves, each once, with a real label", () => {
    const page = readFileSync("src/app/app/[screen]/page.tsx", "utf8");
    expect(new Set(destinations.map(item => item.href)).size).toBe(destinations.length);
    for (const item of destinations) {
      const screen = item.href.replace("/app/", "");
      expect(item.href.startsWith("/app/"), item.href).toBe(true);
      expect(page.includes(`"${screen}"`), `${item.href} must be an allowed screen`).toBe(true);
      const label = translate("en", item.label);
      expect(label, item.href).not.toBe(item.label);
      expect(label.length, item.href).toBeGreaterThan(1);
    }
  });
  it("returns everything for an empty query and ranks label matches above search-term matches", () => {
    expect(searchDestinations(ranked, "")).toHaveLength(destinations.length);
    expect(searchDestinations(ranked, "   ")).toHaveLength(destinations.length);
    expect(searchDestinations(ranked, "sal")[0]!.href).toBe("/app/salary");
    expect(searchDestinations(ranked, "interview")[0]!.href).toBe("/app/interviews");
    // "pay" is only a search term for salary, not in any label that starts with it.
    expect(searchDestinations(ranked, "benchmark").map(item => item.href)).toEqual(["/app/salary"]);
    const career = searchDestinations(ranked, "career");
    expect(career.slice(0, 2).map(item => item.href).sort()).toEqual(["/app/career-assistant", "/app/career-explorer"]);
  });
  it("requires every typed word to match and is case-insensitive", () => {
    expect(searchDestinations(ranked, "WORK PASSPORT").some(item => item.href === "/app/passport")).toBe(true);
    expect(searchDestinations(ranked, "passport zebra")).toEqual([]);
    expect(searchDestinations(ranked, "qqqq")).toEqual([]);
  });
});
