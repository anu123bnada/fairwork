"use client";
import { useEffect, useRef, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { developerKeyList, type developerKeyRow } from "@/features/developer/schema";
import type { z } from "zod";

type Row = z.infer<typeof developerKeyRow>;
const day = (value: string) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

// Keys for the person's own software to verify ORYQEN credentials server to server. The full key is shown once and cannot be
// retrieved again; ORYQEN keeps only a one-way hash. A key cannot read or change any account data.
export function DeveloperAccess() {
  const [rows, setRows] = useState<Row[] | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [label, setLabel] = useState(""), [created, setCreated] = useState<string | null>(null), [copied, setCopied] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const attempt = useRef(0);

  useEffect(() => {
    let active = true;
    appRequest("/api/v1/developer/keys").then(raw => { if (active) setRows(developerKeyList.parse(raw).items); }).catch(() => { if (active) setError("Your keys could not be loaded. Retry when connected."); });
    return () => { active = false; };
  }, []);
  async function reload() { try { setRows(developerKeyList.parse(await appRequest("/api/v1/developer/keys")).items); } catch { setError("Your keys could not be refreshed."); } }

  async function create(event: React.FormEvent) {
    event.preventDefault(); const current = ++attempt.current; setBusy(true); setError(""); setCopied("");
    try {
      const result = await appRequest("/api/v1/developer/keys", { label: label.trim() }) as { key: string };
      if (current === attempt.current) { setCreated(result.key); setLabel(""); }
      await reload();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The key could not be created."); }
    finally { setBusy(false); }
  }
  async function revoke(keyId: string) {
    setBusy(true); setError("");
    try { await appRequest("/api/v1/developer/keys/revoke", { keyId }); setConfirming(null); await reload(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The key could not be revoked."); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(created ?? ""); setCopied("Key copied."); } catch { setCopied("Copying is not available here. Select the key and copy it manually."); }
  }

  return <section className="fw-list-card" aria-label="Developer access">
    <p>Create a key so your own software can check ORYQEN credentials automatically (scope: credentials:verify). A key never reads or changes any account. It allows 60 checks a minute. Keep it secret, like a password.</p>
    {error && <p role="alert">{error}</p>}
    {created && <div role="group" aria-label="New key">
      <p><strong>Copy this key now.</strong> It cannot be shown again.</p>
      <label className="fw-field">New key<input readOnly value={created} onFocus={event => event.target.select()} spellCheck={false} /></label>
      <button type="button" className="fw-secondary" onClick={() => void copy()}>Copy key</button>{copied && <span role="status"> {copied}</span>}
      <button type="button" className="fw-secondary" onClick={() => { setCreated(null); setCopied(""); }}>I have saved it</button>
    </div>}
    <form onSubmit={event => void create(event)} aria-label="Create a key">
      <label className="fw-field">Name for this key (for example, your HR system)<input value={label} maxLength={60} required onChange={event => setLabel(event.target.value)} /></label>
      <button className="fw-primary" disabled={busy || !label.trim()}>{busy ? "Working…" : "Create key"}</button>
    </form>
    {!rows && !error && <p role="status">Loading…</p>}
    {rows?.length === 0 && <p>No keys yet. You can have up to five active keys.</p>}
    <ul>{rows?.map(row => <li key={row.keyId}>
      <strong>{row.label}</strong> · {row.revokedAt ? `revoked ${day(row.revokedAt)}` : `created ${day(row.createdAt)}`} · {row.callsLast24h} checks in the last 24 hours · <span title={row.keyId}>id {row.keyId.slice(0, 8)}…</span>
      {!row.revokedAt && (confirming === row.keyId
        ? <span role="group" aria-label="Confirm revoking"> Revoke for good? <button type="button" className="fw-secondary" disabled={busy} onClick={() => void revoke(row.keyId)}>Revoke now</button><button type="button" className="fw-secondary" onClick={() => setConfirming(null)}>Keep</button></span>
        : <button type="button" className="fw-secondary" disabled={busy} onClick={() => setConfirming(row.keyId)}>Revoke</button>)}
    </li>)}</ul>
  </section>;
}
