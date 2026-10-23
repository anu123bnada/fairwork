"use client";

import { useRef, useState, type FormEvent } from "react";
import { appRequest } from "@/features/authority/client";
import { meSchema, updateProfileSchema } from "@/features/identity/schema";
import type { z } from "zod";
type Profile = z.infer<typeof meSchema>;

export function ProfileEditor({ profile, onSaved }: { profile: Profile; onSaved: (profile: Profile) => void }) {
  const [name, setName] = useState(profile.displayName);
  const [timeZone, setTimeZone] = useState(profile.timeZone);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const pending = useRef<{ payload: string; key: string } | null>(null);
  async function save(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const input = updateProfileSchema.safeParse({ displayName: name, timeZone, locale: "en", expectedRevision: profile.revision });
    if (!input.success) { setFailed(true); setMessage("Enter a name and a valid time zone, such as Asia/Colombo or UTC."); return; }
    const payload = JSON.stringify(input.data);
    if (pending.current?.payload !== payload) pending.current = { payload, key: crypto.randomUUID() };
    setBusy(true); setMessage(""); setFailed(false);
    try {
      const saved = meSchema.parse(await appRequest("/api/v1/me", input.data, pending.current.key, "PATCH"));
      onSaved(saved); setName(saved.displayName); setTimeZone(saved.timeZone);
      pending.current = null; setMessage("Profile saved.");
    } catch (error) {
      setFailed(true); setMessage(error instanceof Error ? error.message : "Your profile could not be saved. Retry or reload to check the latest version.");
    } finally { setBusy(false); }
  }
  return <form className="oq-profile-editor fw-card" onSubmit={event => void save(event)} aria-label="Edit profile">
    <h3>Your profile</h3>
    <label className="fw-field">Display name<input value={name} onChange={event => setName(event.target.value)} required maxLength={80} autoComplete="nickname" disabled={busy} /></label>
    <label className="fw-field">Time zone<input value={timeZone} onChange={event => setTimeZone(event.target.value)} required maxLength={64} placeholder="Asia/Colombo" disabled={busy} /></label>
    <p className="fw-disclaimer">English is currently available. Profile changes are saved to your account.</p>
    <button className="fw-primary" disabled={busy}>{busy ? "Saving profile…" : "Save profile"}</button>
    {message && <p role={failed ? "alert" : "status"}>{message}</p>}
  </form>;
}
