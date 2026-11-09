import { type Page } from "@playwright/test";

export const me = "40000000-0000-4000-8000-000000000001", listingId = "40000000-0000-4000-8000-000000000041";
export type Stored = { id: string; kind: "application" | "project" | "cover_letter" | "portfolio" | "roadmap"; title: string; status: string; content: Record<string, unknown>; revision: number; updatedAt: string };
const time = "2026-11-09T10:00:00Z";

// Transport fixture only (a small stateful fake of the records API): the database tests and the real-stack harness prove ownership, validation and revisions.
export async function setup(page: Page, store: Stored[], saves: Record<string, unknown>[] = [], saveStatus = 200) {
  await page.route("**/api/v1/me", route => route.fulfill({ json: { data: { id: me, displayName: "Nimal Perera", locale: "en", timeZone: "UTC", revision: 1, capabilities: [] } } }));
  await page.route("**/api/v1/opportunities**", route => route.fulfill({ json: { data: { preferences: null, preferenceVersion: 0, nextCursor: null, items: [{ id: listingId, companyId: me, companyName: "Demo Steel Works (DEMO)", version: 1,
    fields: { title: "Welder", description: "MIG welding of steel frames.", location: "Kandy", workMode: "onsite", salary: null, currency: "LKR", payPeriod: "month" }, status: "published", expiresAt: "2027-01-01T00:00:00Z", updatedAt: time, choice: "none", canEdit: false, source: "representative_submission", assurance: "demo_provisioned" }] } } }));
  await page.route(/\/api\/v1\/records(\?.*)?$/, route => {
    const url = new URL(route.request().url());
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as Stored & { expectedRevision: number }; saves.push(body);
      if (saveStatus !== 200) return route.fulfill({ status: saveStatus, json: { error: { code: saveStatus === 409 ? "VERSION_CONFLICT" : "VALIDATION_FAILED" } } });
      const existing = store.find(item => item.id === body.id);
      if (existing) { Object.assign(existing, { title: body.title, status: body.status, content: body.content, revision: existing.revision + 1 }); }
      else store.push({ id: body.id, kind: body.kind, title: body.title, status: body.status, content: body.content, revision: 1, updatedAt: time });
      return route.fulfill({ json: { data: { id: body.id, revision: store.find(item => item.id === body.id)!.revision } } });
    }
    const id = url.searchParams.get("id");
    if (id) return route.fulfill({ json: { data: store.find(item => item.id === id) } });
    const kind = url.searchParams.get("kind");
    const summary = (item: Stored) => { const c = item.content as { organization?: string; nextStepAt?: string; appliedOn?: string; dueOn?: string; tasks?: { done: boolean }[]; events?: unknown[]; milestones?: { done: boolean }[]; category?: string; careerId?: string; role?: string };
      return { id: item.id, kind: item.kind, title: item.title, status: item.status, revision: item.revision, updatedAt: item.updatedAt, summary: { organization: c.organization ?? null, nextStepAt: c.nextStepAt || null, appliedOn: c.appliedOn || null, dueOn: c.dueOn || null, taskCount: c.tasks?.length ?? 0, tasksDone: c.tasks?.filter(task => task.done).length ?? 0, eventCount: c.events?.length ?? 0, milestoneCount: c.milestones?.length ?? 0, milestonesDone: c.milestones?.filter(m => m.done).length ?? 0, category: c.category ?? null, careerId: c.careerId ?? null, role: c.role ?? null } }; };
    return route.fulfill({ json: { data: { limit: 100, items: store.filter(item => item.kind === kind).map(summary) } } });
  });
  await page.route("**/api/v1/records/remove", route => { const { id } = route.request().postDataJSON() as { id: string }; store.splice(0, store.length, ...store.filter(item => item.id !== id)); return route.fulfill({ json: { data: { id } } }); });
}

