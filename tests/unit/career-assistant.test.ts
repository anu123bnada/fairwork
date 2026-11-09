import { describe, expect, it } from "vitest";
import { answerCareerQuestion, suggestedQuestions } from "@/features/careers/assistant";

const ctx = { skills: ["MIG welding", "Safe work"], careerId: "welder" };
describe("career assistant DEMO", () => {
  it("explains the gap from the person's own skills and the sample framework", () => {
    const answer = answerCareerQuestion("Explain my skill gap", ctx);
    expect(answer.topic).toBe("gap");
    const text = answer.text.join(" ");
    expect(text).toContain("SAMPLE");
    expect(text).toContain("67%");
    expect(text).toContain("Reading drawings");
    expect(text).toContain("You already have: MIG welding, Safe work.");
  });
  it("says what to learn first and gives a roadmap in order", () => {
    expect(answerCareerQuestion("What should I learn first?", ctx).text.join(" ")).toContain("Start with Reading drawings");
    const roadmap = answerCareerQuestion("Give me a roadmap", ctx).text;
    expect(roadmap[1]).toMatch(/^1\. Reading drawings/);
  });
  it("answers every suggested question with something non-empty and never claims to be AI or real data", () => {
    for (const question of suggestedQuestions) {
      const answer = answerCareerQuestion(question, ctx);
      expect(answer.text.length, question).toBeGreaterThan(0);
      expect(answer.topic, question).not.toBe("menu");
      expect(answer.text.join(" "), question).not.toMatch(/powered by ai|guarantee/i);
    }
  });
  it("handles no skills and unknown questions honestly", () => {
    expect(answerCareerQuestion("explain my gap", { skills: [], careerId: "driver" }).text.join(" ")).toContain("You have not chosen any skills yet");
    expect(answerCareerQuestion("what is the weather", ctx).topic).toBe("menu");
    expect(answerCareerQuestion("explain my gap", { skills: [], careerId: "nope" }).topic).toBe("menu");
  });
});
