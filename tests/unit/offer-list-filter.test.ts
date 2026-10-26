import { describe, expect, it } from "vitest";
import { filterOffers } from "@/features/offer/list-filter";

const items = [{ role: "Welder", decision: "interested" }, { role: "Warehouse Assistant" }, { role: null, decision: "declined" }, { role: "வெல்டர்", decision: "accepted" }];
describe("saved offer filter", () => {
  it("matches role text case-insensitively, including non-Latin scripts, and trims the query", () => {
    expect(filterOffers(items, "  WELD ", "all").map(item => item.role)).toEqual(["Welder"]);
    expect(filterOffers(items, "வெல்", "all")).toHaveLength(1);
    expect(filterOffers(items, "", "all")).toHaveLength(4);
  });
  it("filters by decision, treating a missing decision as considering", () => {
    expect(filterOffers(items, "", "considering").map(item => item.role)).toEqual(["Warehouse Assistant"]);
    expect(filterOffers(items, "", "declined")).toHaveLength(1);
    expect(filterOffers(items, "a", "interested")).toHaveLength(0);
  });
  it("never matches an untitled offer by text but keeps it under a decision filter", () => {
    expect(filterOffers(items, "null", "all")).toHaveLength(0);
    expect(filterOffers(items, "", "declined")[0]!.role).toBeNull();
  });
});
