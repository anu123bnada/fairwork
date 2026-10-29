import { describe, expect, it } from "vitest";
import { notificationList } from "@/features/identity/notifications-schema";
import { categoryOf, notificationKinds } from "@/features/identity/notification-preferences";

const item = (kind: string, href: string) => ({ eventKey: `e-${kind}`, kind, title: "Synthetic", recordedAt: "2026-10-29T10:00:00Z", read: false, href });

describe("passport sharing notification kinds", () => {
  it("accepts passport_share and passport_view with the Passport link and still refuses unknown kinds and links", () => {
    for (const kind of ["passport_share", "passport_view"]) expect(notificationList.safeParse({ items: [item(kind, "/app/passport")], nextCursor: null }).success).toBe(true);
    expect(notificationList.safeParse({ items: [item("passport_other", "/app/passport")], nextCursor: null }).success).toBe(false);
    expect(notificationList.safeParse({ items: [item("passport_view", "/app/passport/extra")], nextCursor: null }).success).toBe(false);
  });
  it("every kind belongs to a hideable-or-essential category", () => {
    for (const kind of notificationKinds) expect(categoryOf[kind]).toBeTruthy();
  });
});
