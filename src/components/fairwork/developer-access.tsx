"use client";
import { useEffect, useRef, useState } from "react";
import { appRequest } from "@/features/authority/client";
import { developerKeyList, webhookList, type developerKeyRow, type webhookRow } from "@/features/developer/schema";
import type { z } from "zod";

type Row = z.infer<typeof developerKeyRow>;
type Hook = z.infer<typeof webhookRow>;
const day = (value: string) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });

// Keys for the person's own software to verify ORYQEN credentials server to server. The full key is shown once and cannot be
// retrieved again; ORYQEN keeps only a one-way hash. A key cannot read or change any account data.
export function DeveloperAccess() {
  const [rows, setRows] = useState<Row[] | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [label, setLabel] = useState(""), [created, setCreated] = useState<string | null>(null), [copied, setCopied] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);
  const attempt = useRef(0);
  const [hooks, setHooks] = useState<Hook[] | null>(null), [hookUrl, setHookUrl] = useState(""), [hookSecret, setHookSecret] = useState<string | null>(null);
  const [hookNotice, setHookNotice] = useState(""), [hookConfirm, setHookConfirm] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    appRequest("/api/v1/developer/keys").then(raw => { if (active) setRows(developerKeyList.parse(raw).items); }).catch(() => { if (active) setError("Your keys could not be loaded. Retry when connected."); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    appRequest("/api/v1/developer/webhooks").then(raw => { if (active) setHooks(webhookList.parse(raw).items); }).catch(() => { if (active) setError("Your webhook endpoints could not be loaded. Retry when connected."); });
    return () => { active = false; };
  }, []);
  async function reloadHooks() { try { setHooks(webhookList.parse(await appRequest("/api/v1/developer/webhooks")).items); } catch { setError("Your webhook endpoints could not be refreshed."); } }
  async function addHook(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setHookNotice("");
    try {
      const result = await appRequest("/api/v1/developer/webhooks", { url: hookUrl.trim() }) as { secret: string };
      setHookSecret(result.secret); setHookUrl(""); await reloadHooks();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The endpoint could not be added."); }
    finally { setBusy(false); }
  }
  async function testHook(webhookId: string) {
    setBusy(true); setError(""); setHookNotice("");
    try {
      const result = await appRequest("/api/v1/developer/webhooks/test", { webhookId }) as { outcome: string; statusCode: number | null };
      setHookNotice(result.outcome === "delivered" ? `Test event delivered (HTTP ${result.statusCode}).` : `Test event not delivered${result.statusCode ? ` (HTTP ${result.statusCode})` : " (no response)"}. Check that the address is reachable and returns a 2xx answer.`);
      await reloadHooks();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The test event could not be sent."); }
    finally { setBusy(false); }
  }
  async function removeHook(webhookId: string) {
    setBusy(true); setError("");
    try { await appRequest("/api/v1/developer/webhooks/delete", { webhookId }); setHookConfirm(null); await reloadHooks(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "The endpoint could not be removed."); }
    finally { setBusy(false); }
  }
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

    <h4>Webhook endpoints</h4>
    <p>Add up to three https addresses of your own. ORYQEN sends them a signed event when you revoke one of your credentials, and a test event on request. Each delivery carries <code>Oryqen-Signature</code> (HMAC-SHA256 of the timestamp and body), <code>Oryqen-Event-Id</code> and a timestamp; reject anything older than five minutes and ignore an event id you have already handled. Failed deliveries are retried twice. Delivery is best effort and is not queued across restarts.</p>
    {hookSecret && <div role="group" aria-label="New signing secret">
      <p><strong>Copy this signing secret now.</strong> It cannot be shown again.</p>
      <label className="fw-field">Signing secret<input readOnly value={hookSecret} onFocus={event => event.target.select()} spellCheck={false} /></label>
      <button type="button" className="fw-secondary" onClick={() => setHookSecret(null)}>I have saved it</button>
    </div>}
    {hookNotice && <p role="status">{hookNotice}</p>}
    <form onSubmit={event => void addHook(event)} aria-label="Add a webhook endpoint">
      <label className="fw-field">Endpoint address (https)<input type="url" value={hookUrl} maxLength={300} required onChange={event => setHookUrl(event.target.value)} /></label>
      <button className="fw-primary" disabled={busy || !hookUrl.trim()}>{busy ? "Working…" : "Add endpoint"}</button>
    </form>
    {hooks?.length === 0 && <p>No endpoints yet.</p>}
    <ul aria-label="Webhook endpoints">{hooks?.map(hook => <li key={hook.webhookId}>
      <strong>{hook.url}</strong> · {hook.lastDelivery ? `last delivery ${hook.lastDelivery.outcome === "delivered" ? "succeeded" : "failed"}${hook.lastDelivery.statusCode ? ` (HTTP ${hook.lastDelivery.statusCode})` : ""} · ${hook.lastDelivery.eventType} · ${day(hook.lastDelivery.at)}` : "no deliveries yet"}
      <button type="button" className="fw-secondary" disabled={busy} onClick={() => void testHook(hook.webhookId)}>Send test event</button>
      {hookConfirm === hook.webhookId
        ? <span role="group" aria-label="Confirm removing"> Remove this endpoint? <button type="button" className="fw-secondary" disabled={busy} onClick={() => void removeHook(hook.webhookId)}>Remove now</button><button type="button" className="fw-secondary" onClick={() => setHookConfirm(null)}>Keep</button></span>
        : <button type="button" className="fw-secondary" disabled={busy} onClick={() => setHookConfirm(hook.webhookId)}>Remove endpoint</button>}
    </li>)}</ul>
  </section>;
}
