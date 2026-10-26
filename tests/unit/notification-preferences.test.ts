import { describe, expect, it } from "vitest";
import { categories, categoryOf, filterNotifications, hiddenFromStorage, notificationKinds, toggleCategory } from "@/features/identity/notification-preferences";

const item = (kind: (typeof notificationKinds)[number]) => ({ kind, id: kind });

describe("notification preferences", () => {
  it("maps every notification kind to a category", () => {
    for (const kind of notificationKinds) expect(categories).toContain(categoryOf[kind]);
  });
  it("hides chosen categories but never the essential one", () => {
    const items = notificationKinds.map(item);
    const { shown, hiddenCount } = filterNotifications(items, ["offers", "work", "cases"]);
    expect(shown.map(entry => entry.kind).sort()).toEqual(["agreement_decision", "case_followup", "organization_decision"]);
    expect(hiddenCount).toBe(3);
    expect(filterNotifications(items, []).hiddenCount).toBe(0);
  });
  it("toggles categories and refuses to hide case responses", () => {
    expect(toggleCategory([], "offers", false)).toEqual(["offers"]);
    expect(toggleCategory(["offers"], "offers", true)).toEqual([]);
    expect(toggleCategory([], "cases", false)).toEqual([]);
    expect(toggleCategory(["offers"], "work", false).sort()).toEqual(["offers", "work"]);
  });
  it("reads storage defensively", () => {
    expect(hiddenFromStorage(null)).toEqual([]);
    expect(hiddenFromStorage("not json")).toEqual([]);
    expect(hiddenFromStorage('{"a":1}')).toEqual([]);
    expect(hiddenFromStorage('["offers","cases","nonsense",5]')).toEqual(["offers"]);
  });
});
