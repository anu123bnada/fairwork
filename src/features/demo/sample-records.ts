import { emptyApplication, emptyCoverLetter, emptyPortfolio, emptyProject, emptyRoadmap, recordSaveInput, type RecordKind } from "@/features/records/schema";
import { sampleCareerById } from "@/features/careers/sample-data";
import { computeGap } from "@/features/careers/gap";
import { generateCoverLetter } from "@/features/cover-letter/generate";
import type { z } from "zod";

// Sample records for the exhibition. They are written to the signed-in person's OWN private records through the normal API (so they persist, reload and follow the same rules),
// every title ends with the marker below, and removing them deletes only records that carry it. They are synthetic and unverified.
export const DEMO_MARK = " (DEMO)";
export type SampleBody = z.infer<typeof recordSaveInput>;
const uuid = () => crypto.randomUUID();
const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString();
const day = (days: number) => inDays(days).slice(0, 10);
const time = (days: number, hhmm: string) => `${day(days)}T${hhmm}`;

export function sampleRecordBodies(): SampleBody[] {
  const welder = computeGap("welder", ["MIG welding", "Safe work"])!;
  const letter = generateCoverLetter({ name: "Demo Visitor", role: "Welder", organization: "Demo Steel Works", contact: "", opening: "", strengths: ["MIG welding", "safe work", "reading drawings"], example: "I repaired twelve gate frames in one week without rework", closing: "", tone: "formal" }).text;
  return recordSaveInput.array().parse([
    { id: uuid(), kind: "application", title: `Warehouse Assistant${DEMO_MARK}`, status: "interviewing", expectedRevision: 0, content: { ...emptyApplication, organization: "Demo Logistics (SAMPLE)", location: "Colombo", appliedOn: day(-6), nextStepAt: time(2, "10:00"), notes: "Synthetic sample record for the exhibition.", prep: [true, true, true, false, false, false],
      events: [{ id: uuid(), kind: "interview", at: time(-2, "09:30"), notes: "Phone screen with the supervisor", stage: "phone_screen", status: "completed", outcome: "passed", questions: "Ask about overtime pay and the notice period.", feedback: "Friendly. They did not state working hours; ask for them in writing." },
        { id: uuid(), kind: "interview", at: time(2, "10:00"), notes: "Visit to the warehouse", stage: "final", status: "scheduled", outcome: "pending", questions: "What is the uniform deposit for and is it refundable in writing?", feedback: "" },
        { id: uuid(), kind: "follow_up", at: time(-1, "16:00"), notes: "Sent a thank-you message", stage: "other", status: "scheduled", outcome: "pending", questions: "", feedback: "" }] } },
    { id: uuid(), kind: "application", title: `Retail Assistant${DEMO_MARK}`, status: "applied", expectedRevision: 0, content: { ...emptyApplication, organization: "Demo Stores Lanka (SAMPLE)", location: "Colombo", appliedOn: day(-3), nextStepAt: day(4), notes: "Waiting for a reply.", prep: [true, false, false, false, false, false] } },
    { id: uuid(), kind: "application", title: `Accounts Clerk${DEMO_MARK}`, status: "saved", expectedRevision: 0, content: { ...emptyApplication, organization: "Demo Accounting Partners (SAMPLE)", location: "Galle", notes: "Saved to apply next week." } },
    { id: uuid(), kind: "project", title: `Workshop tidy-up${DEMO_MARK}`, status: "active", expectedRevision: 0, content: { ...emptyProject, description: "Synthetic sample project for the exhibition.", dueOn: day(14),
      milestones: [{ id: uuid(), title: "Sort and label tools", done: true, dueOn: day(-2) }, { id: uuid(), title: "New shelving installed", done: false, dueOn: day(10) }],
      tasks: [{ id: uuid(), title: "Label shelves", done: true }, { id: uuid(), title: "Clean the workbench", done: true }, { id: uuid(), title: "Order safety signs", done: false }, { id: uuid(), title: "Update the tool register", done: false }] } },
    { id: uuid(), kind: "cover_letter", title: `Welder at Demo Steel Works${DEMO_MARK}`, status: "draft", expectedRevision: 0, content: { ...emptyCoverLetter, organization: "Demo Steel Works", role: "Welder", body: letter } },
    { id: uuid(), kind: "portfolio", title: `Workplace safety course${DEMO_MARK}`, status: "ready", expectedRevision: 0, content: { ...emptyPortfolio, category: "certificate", summary: "Synthetic sample entry: a basic workplace safety course.", skills: ["Safe work"], outcome: "Sample entry, not a real certificate.", date: day(-30) } },
    { id: uuid(), kind: "roadmap", title: `${sampleCareerById("welder")!.title} roadmap${DEMO_MARK}`, status: "active", expectedRevision: 0, content: { ...emptyRoadmap, careerId: "welder", notes: "Sample roadmap built from the SAMPLE framework.",
      milestones: welder.roadmap.map((step, index) => ({ id: uuid(), title: `Learn: ${step.skill}`, skill: step.skill, done: index === 0, dueOn: day(10 + index * 7) })) } },
  ]);
}
export const kindsToCheck: RecordKind[] = ["application", "project", "cover_letter", "portfolio", "roadmap"];
