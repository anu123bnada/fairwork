import { z } from "zod";

// Personal records: the person's own job applications (with interview and follow-up events) and Workroom projects (with milestones and tasks). Everything is typed by the person,
// is private to them, and is not verified by anyone. The database re-checks the status lists, the allowed keys per kind, the size and ownership.
export const applicationStatuses = ["saved", "applied", "interviewing", "offered", "accepted", "rejected", "withdrawn"] as const;
export const projectStatuses = ["planned", "active", "blocked", "done", "archived"] as const;
export const coverLetterStatuses = ["draft", "final"] as const;
export const portfolioStatuses = ["draft", "ready"] as const;
export const roadmapStatuses = ["active", "done", "archived"] as const;
export const portfolioCategories = ["project", "certificate", "achievement", "work_sample"] as const;
export const interviewStages = ["phone_screen", "technical", "panel", "final", "other"] as const;
export const interviewStatuses = ["scheduled", "completed", "cancelled"] as const;
export const interviewOutcomes = ["pending", "passed", "not_selected", "offer"] as const;
export const prepItems = ["employer", "description", "examples", "questions", "logistics", "documents"] as const;
const text = (max: number) => z.string().max(max);
const day = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, "Use a date like 2026-11-20");
const dateTime = z.string().regex(/^(\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?)?$/, "Use a date like 2026-11-20 or 2026-11-20T09:30");

export const applicationContent = z.strictObject({
  listingId: z.uuid().nullable(), organization: text(120), location: text(120), appliedOn: day, nextStepAt: dateTime, notes: text(2000),
  events: z.array(z.strictObject({ id: z.uuid(), kind: z.enum(["interview", "follow_up", "note"]), at: dateTime, notes: text(500),
    stage: z.enum(interviewStages).default("other"), status: z.enum(interviewStatuses).default("scheduled"), outcome: z.enum(interviewOutcomes).default("pending"), questions: text(800).default(""), feedback: text(800).default("") })).max(30),
  prep: z.array(z.boolean()).max(10),
});
export const projectContent = z.strictObject({
  description: text(1000), dueOn: day,
  milestones: z.array(z.strictObject({ id: z.uuid(), title: text(120), done: z.boolean(), dueOn: day })).max(20),
  tasks: z.array(z.strictObject({ id: z.uuid(), title: text(160), done: z.boolean() })).max(50),
});
export const coverLetterContent = z.strictObject({ organization: text(120), role: text(120), tone: z.enum(["formal", "friendly"]), body: text(8000), applicationId: z.uuid().nullable() });
export const portfolioContent = z.strictObject({ category: z.enum(portfolioCategories), link: z.string().max(300).regex(/^(https:\/\/[^\s]+)?$/, "Use a link starting with https://"), summary: text(1000), skills: z.array(text(60)).max(15), outcome: text(500), date: day });
export const roadmapContent = z.strictObject({ careerId: text(60), milestones: z.array(z.strictObject({ id: z.uuid(), title: text(120), skill: text(60), done: z.boolean(), dueOn: day })).max(30), notes: text(1000) });
export type CoverLetterContent = z.infer<typeof coverLetterContent>;
export type PortfolioContent = z.infer<typeof portfolioContent>;
export type RoadmapContent = z.infer<typeof roadmapContent>;
export const emptyCoverLetter: CoverLetterContent = { organization: "", role: "", tone: "formal", body: "", applicationId: null };
export const emptyPortfolio: PortfolioContent = { category: "project", link: "", summary: "", skills: [], outcome: "", date: "" };
export const emptyRoadmap: RoadmapContent = { careerId: "", milestones: [], notes: "" };
export type ApplicationContent = z.infer<typeof applicationContent>;
export type ProjectContent = z.infer<typeof projectContent>;
export const emptyApplication: ApplicationContent = { listingId: null, organization: "", location: "", appliedOn: "", nextStepAt: "", notes: "", events: [], prep: prepItems.map(() => false) };
export const emptyProject: ProjectContent = { description: "", dueOn: "", milestones: [], tasks: [] };

const title = z.string().trim().min(1).max(120);
const base = { id: z.uuid(), title, expectedRevision: z.number().int().min(0) };
export const recordSaveInput = z.discriminatedUnion("kind", [
  z.strictObject({ ...base, kind: z.literal("application"), status: z.enum(applicationStatuses), content: applicationContent }),
  z.strictObject({ ...base, kind: z.literal("project"), status: z.enum(projectStatuses), content: projectContent }),
  z.strictObject({ ...base, kind: z.literal("cover_letter"), status: z.enum(coverLetterStatuses), content: coverLetterContent }),
  z.strictObject({ ...base, kind: z.literal("portfolio"), status: z.enum(portfolioStatuses), content: portfolioContent }),
  z.strictObject({ ...base, kind: z.literal("roadmap"), status: z.enum(roadmapStatuses), content: roadmapContent }),
]);
export const recordKind = z.enum(["application", "project", "cover_letter", "portfolio", "roadmap"]);
export type RecordKind = z.infer<typeof recordKind>;
export const recordSaved = z.strictObject({ id: z.uuid(), revision: z.number().int().positive() });
export const recordSummary = z.strictObject({
  id: z.uuid(), kind: recordKind, title: z.string(), status: z.string(), revision: z.number().int().positive(), updatedAt: z.string(),
  summary: z.strictObject({ organization: z.string().nullable(), nextStepAt: z.string().nullable(), appliedOn: z.string().nullable(), dueOn: z.string().nullable(), taskCount: z.number(), tasksDone: z.number(), eventCount: z.number(), milestoneCount: z.number(), milestonesDone: z.number(), category: z.string().nullable(), careerId: z.string().nullable(), role: z.string().nullable() }),
});
export const recordList = z.strictObject({ items: z.array(recordSummary).max(100), limit: z.literal(100) });
export const recordDocument = z.discriminatedUnion("kind", [
  z.strictObject({ id: z.uuid(), kind: z.literal("application"), title: z.string(), status: z.enum(applicationStatuses), content: applicationContent, revision: z.number().int().positive(), updatedAt: z.string() }),
  z.strictObject({ id: z.uuid(), kind: z.literal("project"), title: z.string(), status: z.enum(projectStatuses), content: projectContent, revision: z.number().int().positive(), updatedAt: z.string() }),
  z.strictObject({ id: z.uuid(), kind: z.literal("cover_letter"), title: z.string(), status: z.enum(coverLetterStatuses), content: coverLetterContent, revision: z.number().int().positive(), updatedAt: z.string() }),
  z.strictObject({ id: z.uuid(), kind: z.literal("portfolio"), title: z.string(), status: z.enum(portfolioStatuses), content: portfolioContent, revision: z.number().int().positive(), updatedAt: z.string() }),
  z.strictObject({ id: z.uuid(), kind: z.literal("roadmap"), title: z.string(), status: z.enum(roadmapStatuses), content: roadmapContent, revision: z.number().int().positive(), updatedAt: z.string() }),
]);
export const recordDeleteInput = z.strictObject({ id: z.uuid() });
export const recordDeleted = z.strictObject({ id: z.uuid() });
export type RecordSummary = z.infer<typeof recordSummary>;
export type RecordDocument = z.infer<typeof recordDocument>;
