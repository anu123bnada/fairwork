import { describe, expect, it } from "vitest";
import { answerQuestion, helpEntries, helpLinkTargets } from "@/features/help/knowledge";

const topic = (question: string) => answerQuestion(question)?.entry.id ?? null;

describe("Help assistant knowledge", () => {
  it("has unique ids, bounded answers and links only to known screens", () => {
    expect(new Set(helpEntries.map(entry => entry.id)).size).toBe(helpEntries.length);
    for (const entry of helpEntries) {
      expect(entry.answer.length, entry.id).toBeGreaterThan(40);
      expect(entry.answer.length, entry.id).toBeLessThanOrEqual(800);
      for (const link of entry.links) expect(helpLinkTargets as readonly string[], `${entry.id} -> ${link.href}`).toContain(link.href);
    }
  });

  it("never claims to be AI or to guarantee anything, and describes unbuilt features as not available", () => {
    for (const entry of helpEntries) {
      expect(entry.answer, entry.id).not.toMatch(/powered by ai|ai-powered|\b(we|oryqen|this assistant) guarantee|guaranteed (safe|secure|accurate)|100% (safe|secure|accurate)/i);
    }
    const missing = helpEntries.find(entry => entry.id === "not-available")!.answer;
    for (const word of ["Challenge Arena", "LinkedIn", "payments", "planned, not available"]) expect(missing).toContain(word);
    expect(helpEntries.find(entry => entry.id === "this-assistant")!.answer).toMatch(/^No\./);
    expect(helpEntries.find(entry => entry.id === "ai-status")!.answer).toMatch(/switched off/);
  });

  it("answers the common questions with the right topic", () => {
    expect(topic("how do I add a job offer?")).toBe("add-offer");
    expect(topic("I want to paste my offer text")).toBe("add-offer");
    expect(topic("Why is AI analysis not working?")).toBe("ai-status");
    expect(topic("my ai agent is not working")).toBe("ai-status");
    expect(topic("are you a chatbot?")).toBe("this-assistant");
    expect(topic("how can I make a CV")).toBe("cv-builder");
    expect(topic("how do I improve my cv score")).toBe("cv-analyzer");
    expect(topic("what is an ats checker")).toBe("cv-analyzer");
    expect(topic("how do I share my passport")).toBe("passport-share");
    expect(topic("how to revoke access to my work passport")).toBe("passport-share");
    expect(topic("where do I upload payslips")).toBe("evidence");
    expect(topic("I forgot my password")).toBe("account-security");
    expect(topic("how do I delete my account")).toBe("privacy-data");
    expect(topic("can I change language to Sinhala")).toBe("language");
    expect(topic("is there a challenge arena or linkedin")).toBe("not-available");
    expect(topic("how do I pay for premium")).toBe("not-available");
    expect(topic("is this job a scam")).toBe("scam");
  });

  it("says it does not know instead of guessing, and handles empty or odd input", () => {
    expect(answerQuestion("")).toBeNull();
    expect(answerQuestion("   ")).toBeNull();
    expect(answerQuestion("?!?!")).toBeNull();
    expect(answerQuestion("what is the capital of France")).toBeNull();
    expect(answerQuestion("asdf qwerty zxcv")).toBeNull();
    expect(answerQuestion("a".repeat(5000))).toBeNull();
  });

  it("returns at most two related topics, never the answer itself, and treats the question as plain text", () => {
    const result = answerQuestion("how do I share my passport and upload documents")!;
    expect(result.related.length).toBeLessThanOrEqual(2);
    expect(result.related.every(entry => entry.id !== result.entry.id)).toBe(true);
    expect(topic("<script>alert(1)</script> how do I add an offer")).toBe("add-offer");
  });
});
