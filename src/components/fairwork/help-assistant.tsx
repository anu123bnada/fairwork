"use client";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { answerQuestion, helpEntries, type HelpEntry } from "@/features/help/knowledge";
import { useI18n } from "@/i18n/use-i18n";
import "./help-assistant.css";

type Message = { id: number; from: "you" | "bot"; text: string; entry?: HelpEntry; related?: HelpEntry[]; topics?: HelpEntry[] };
const starters = helpEntries.filter(entry => ["add-offer", "ai-status", "cv-builder", "passport-share", "evidence", "scam", "privacy-data", "not-available"].includes(entry.id));

// A help chat that answers only from a written guide (no AI, no network, nothing stored). It cannot see the person's records.
export function HelpAssistant() {
  const { t } = useI18n();
  const next = useRef(1);
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");

  function ask(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const result = answerQuestion(trimmed);
    const you: Message = { id: next.current++, from: "you", text: trimmed.slice(0, 300) };
    const bot: Message = result
      ? { id: next.current++, from: "bot", text: result.entry.answer, entry: result.entry, related: result.related }
      : { id: next.current++, from: "bot", text: t("help.noMatch"), topics: starters };
    setMessages(current => [...current, you, bot]);
    setQuestion("");
  }
  const submit = (event: FormEvent) => { event.preventDefault(); ask(question); };

  return <section className="oq-help" aria-label={t("help.aria")}>
    <p>{t("help.intro")}</p>
    <p className="oq-help-badge">{t("help.badge")}</p>
    <div className="oq-help-log" role="log" aria-live="polite" aria-label={t("help.logAria")}>
      <div className="oq-help-msg oq-help-bot"><strong>{t("help.bot")}</strong><p>{t("help.greeting")}</p></div>
      {messages.map(message => <div key={message.id} className={`oq-help-msg ${message.from === "you" ? "oq-help-you" : "oq-help-bot"}`}>
        <strong>{message.from === "you" ? t("help.you") : t("help.bot")}</strong>
        <p>{message.text}</p>
        {message.entry && message.entry.links.length > 0 && <p className="oq-help-links">{message.entry.links.map(item => <Link key={item.href} className="fw-secondary" href={item.href}>{item.label}</Link>)}</p>}
        {message.related && message.related.length > 0 && <p className="oq-help-links"><span>{t("help.related")}</span>{message.related.map(entry => <button key={entry.id} type="button" className="fw-secondary" onClick={() => ask(entry.title)}>{entry.title}</button>)}</p>}
        {message.topics && <p className="oq-help-links">{message.topics.map(entry => <button key={entry.id} type="button" className="fw-secondary" onClick={() => ask(entry.title)}>{entry.title}</button>)}</p>}
      </div>)}
    </div>
    {messages.length === 0 && <p className="oq-help-links" aria-label={t("help.topics")}>{starters.map(entry => <button key={entry.id} type="button" className="fw-secondary" onClick={() => ask(entry.title)}>{entry.title}</button>)}</p>}
    <form onSubmit={submit} className="oq-help-form">
      <label className="fw-field">{t("help.label")}<input value={question} maxLength={300} onChange={event => setQuestion(event.target.value)} autoComplete="off" /></label>
      <button className="fw-primary" disabled={!question.trim()}>{t("help.ask")}</button>
      <button type="button" className="fw-secondary" disabled={messages.length === 0} onClick={() => setMessages([])}>{t("help.clear")}</button>
    </form>
    <p className="oq-help-note">{t("help.english")}</p>
  </section>;
}
