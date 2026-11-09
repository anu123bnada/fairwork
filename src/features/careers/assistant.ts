import { computeGap } from "./gap";
import { sampleCareerById, sampleCareers } from "./sample-data";

// Career Assistant DEMO. These are deterministic, rule-based answers built from the person's own skill list and the SAMPLE career framework. No AI model is called and nothing
// is stored. Every answer says so. It never claims to know real jobs, pay or hiring outcomes.
export type AssistantContext = { skills: string[]; careerId: string };
export type AssistantAnswer = { topic: "gap" | "roadmap" | "apply" | "interview" | "cover" | "offer" | "next" | "menu"; text: string[] };

export const suggestedQuestions = ["Explain my skill gap", "What should I learn first?", "Give me a roadmap", "How do I improve my application?", "How do I prepare for an interview?", "What could my next role be?", "Is my job offer fair?"] as const;
const has = (question: string, words: string[]) => words.some(word => question.includes(word));

export function answerCareerQuestion(raw: string, ctx: AssistantContext): AssistantAnswer {
  const q = raw.toLowerCase();
  const gap = computeGap(ctx.careerId, ctx.skills);
  const career = gap?.career ?? sampleCareerById(ctx.careerId) ?? sampleCareers[0]!;
  const noSkills = ctx.skills.length === 0;
  if (has(q, ["gap", "missing", "explain my", "what skills", "lack"])) {
    if (!gap) return menu();
    return { topic: "gap", text: [
      `Target role (SAMPLE): ${career.title}. You cover ${gap.coreCoveragePercent}% of its core skills.${noSkills ? " You have not chosen any skills yet, so open Career explorer and tick the ones you have." : ""}`,
      gap.have.length ? `You already have: ${gap.have.join(", ")}.` : "No skills matched yet.",
      gap.missingCore.length ? `Core skills still missing: ${gap.missingCore.join(", ")}. Core skills are the ones this sample framework treats as essential, so they come first.` : "You cover every core skill in this sample role.",
      gap.missingHelpful.length ? `Helpful but not essential: ${gap.missingHelpful.join(", ")}.` : "",
    ].filter(Boolean) };
  }
  if (has(q, ["first", "start", "begin", "priority"])) {
    const first = gap?.roadmap[0];
    return { topic: "roadmap", text: first ? [`Start with ${first.skill} (${first.weight === "core" ? "core" : "helpful"} for ${career.title} in the sample framework).`, first.step || "Ask someone working in the role what they would practise first."] : [`In the sample framework you already cover every skill for ${career.title}. A good next step is to record proof in your Portfolio.`] };
  }
  if (has(q, ["roadmap", "plan", "steps", "how do i become"])) {
    const steps = gap?.roadmap.slice(0, 4) ?? [];
    return { topic: "roadmap", text: steps.length ? [`A sample roadmap for ${career.title}, in order:`, ...steps.map((step, index) => `${index + 1}. ${step.skill}: ${step.step}`), "Press Save a roadmap in Career explorer to keep it and tick milestones as you go."] : [`Nothing is left to plan for ${career.title} in the sample framework.`] };
  }
  if (has(q, ["next role", "next job", "grow", "promotion", "career path", "after this"])) {
    return { topic: "next", text: gap && gap.nextRoles.length ? [`After ${career.title}, this sample framework lists: ${gap.nextRoles.map(role => role.title).join(", ")}.`, "These are example paths for the demonstration, not predictions about real jobs."] : [`This sample framework lists no later role after ${career.title}.`] };
  }
  if (has(q, ["cover letter", "cover"])) {
    return { topic: "cover", text: ["Keep it short: who you are, the job, two or three strengths, one real example.", "Use the Cover letter screen: it builds a plain template from your own words and adds no facts about you. Only write things that are true."] };
  }
  if (has(q, ["apply", "application", "cv", "resume", "improve"])) {
    return { topic: "apply", text: ["1. Use the CV Analyzer and paste the job description: it shows which of its terms your CV already uses.", "2. Put the most relevant experience first and keep each line to what you did and the result.", "3. Apply through Job opportunities so you can follow the status in Application tracker.", "4. Write down a follow-up date in the tracker and keep your notes there.", "These are general tips from rules, not a prediction of any employer's decision."] };
  }
  if (has(q, ["interview", "prepare"])) {
    return { topic: "interview", text: ["Before: research the employer, re-read the job description, prepare three real examples, and check the time and place or link. Tick these in Application tracker.", "During: answer with a situation, what you did, and the result. Ask about shifts, training and who you would report to.", "After: write the questions and feedback in Interviews so you learn from each one."] };
  }
  if (has(q, ["offer", "salary", "pay", "contract", "fair"])) {
    return { topic: "offer", text: ["Paste the offer into Add a job offer to get the rule-based report: pay, hours, leave, contract clarity, missing terms and risk indicators, each explained.", "It is not legal advice and cannot check whether the employer is real. If something is missing, ask for it in writing before you accept."] };
  }
  return menu();
}
function menu(): AssistantAnswer {
  return { topic: "menu", text: ["I can explain your skill gap, say what to learn first, outline a roadmap, suggest your next role, and give general tips on applications, cover letters, interviews and offers.", "Try one of the suggested questions."] };
}
