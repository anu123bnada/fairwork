// SYNTHETIC organization sandbox for the exhibition. Every applicant below is fictional. It runs entirely on this device (nothing is sent to ORYQEN, no organization exists, nobody is
// verified) so visitors can see both sides of the applicant workflow without an approved organization account. The real workflow is separate and permission-checked.
export const orgDemoListing = { title: "Warehouse Assistant (SAMPLE)", company: "Demo Logistics (SAMPLE)", location: "Colombo" };
export const reviewStates = ["submitted", "reviewing", "shortlisted", "declined"] as const;
export type ReviewState = (typeof reviewStates)[number];
export type DemoApplicant = { id: string; name: string; message: string };
export const VISITOR_ID = "visitor";

export const sampleApplicants: readonly DemoApplicant[] = [
  { id: "a1", name: "Nimali Fernando (SAMPLE)", message: "Two years of warehouse work and a forklift certificate." },
  { id: "a2", name: "Kasun Perera (SAMPLE)", message: "I can start next week and have my own transport." },
  { id: "a3", name: "Dilani Silva (SAMPLE)", message: "Worked in stock control at a supermarket for three years." },
  { id: "a4", name: "Ruwan Jayasinghe (SAMPLE)", message: "" },
];

export type OrgDemoState = { statuses: Record<string, ReviewState>; visitorApplied: boolean; visitorMessage: string };
export const initialOrgDemo: OrgDemoState = { statuses: Object.fromEntries(sampleApplicants.map(item => [item.id, "submitted" as ReviewState])), visitorApplied: false, visitorMessage: "" };

// Parses what was stored on the device and falls back to the initial state for anything unexpected.
export function parseOrgDemo(raw: unknown): OrgDemoState {
  if (!raw || typeof raw !== "object") return initialOrgDemo;
  const value = raw as Partial<OrgDemoState>;
  const statuses: Record<string, ReviewState> = { ...initialOrgDemo.statuses };
  for (const [key, state] of Object.entries(value.statuses ?? {})) if ((key === VISITOR_ID || key in statuses) && (reviewStates as readonly string[]).includes(state as string)) statuses[key] = state as ReviewState;
  return { statuses, visitorApplied: value.visitorApplied === true, visitorMessage: typeof value.visitorMessage === "string" ? value.visitorMessage.slice(0, 300) : "" };
}

export function applicantsOf(state: OrgDemoState): (DemoApplicant & { status: ReviewState })[] {
  const list: DemoApplicant[] = [...sampleApplicants];
  if (state.visitorApplied) list.unshift({ id: VISITOR_ID, name: "You, as a sample visitor (SAMPLE)", message: state.visitorMessage });
  return list.map(item => ({ ...item, status: state.statuses[item.id] ?? "submitted" }));
}
export function countsOf(state: OrgDemoState): Record<ReviewState, number> {
  const counts: Record<ReviewState, number> = { submitted: 0, reviewing: 0, shortlisted: 0, declined: 0 };
  for (const item of applicantsOf(state)) counts[item.status] += 1;
  return counts;
}
