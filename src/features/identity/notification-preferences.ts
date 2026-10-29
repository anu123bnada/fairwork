// Notification preferences (module 20). Preferences choose which kinds of activity the in-app feed shows on this device. They never
// stop an event from being recorded, never delete anything, and cannot hide the essential kinds below, which affect a person's rights.
export const notificationKinds = ["offer_revision", "organization_decision", "agreement_decision", "work_decision", "work_integrity", "case_followup", "passport_share", "passport_view"] as const;
export type NotificationKind = (typeof notificationKinds)[number];
export const categories = ["offers", "agreements", "work", "organization", "cases"] as const;
export type NotificationCategory = (typeof categories)[number];

export const categoryOf: Record<NotificationKind, NotificationCategory> = {
  offer_revision: "offers", agreement_decision: "agreements", work_decision: "work", work_integrity: "work", organization_decision: "organization", case_followup: "cases",
  // Passport sharing activity is shown with work activity.
  passport_share: "work", passport_view: "work",
};
// Dispute activity and decisions about a person's own work record are never hideable: missing them could cost someone a deadline or a right.
export const essentialCategories: readonly NotificationCategory[] = ["cases"];
export const STORAGE_KEY = "oryqen.notifications.hidden";

export function hiddenFromStorage(raw: string | null): NotificationCategory[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return categories.filter(category => parsed.includes(category) && !essentialCategories.includes(category));
  } catch { return []; }
}
export function filterNotifications<T extends { kind: NotificationKind }>(items: readonly T[], hidden: readonly NotificationCategory[]) {
  const shown = items.filter(item => !hidden.includes(categoryOf[item.kind]) || essentialCategories.includes(categoryOf[item.kind]));
  return { shown, hiddenCount: items.length - shown.length };
}
export function toggleCategory(hidden: readonly NotificationCategory[], category: NotificationCategory, visible: boolean): NotificationCategory[] {
  if (essentialCategories.includes(category)) return [...hidden].filter(entry => entry !== category);
  const rest = hidden.filter(entry => entry !== category);
  return visible ? rest : [...rest, category];
}
