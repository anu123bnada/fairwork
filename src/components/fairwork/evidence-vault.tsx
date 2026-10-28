"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { appRequest, ApiRequestError } from "@/features/authority/client";
import { errorMessages, type ErrorCode } from "@/lib/errors";
import { vaultCategories, vaultLimits, vaultListResponse, type VaultCategory, type VaultDocument } from "@/features/vault/schema";
import { useI18n } from "@/i18n/use-i18n";
import { evidenceStatusList, type EvidenceStatus } from "@/features/vault/evidence";
import { DocumentStatus } from "./evidence-status";

const accepted = ".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp";
const size = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const day = (value: string) => new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
const CATEGORY_LABEL: Record<VaultCategory, string> = { certificate: "Certificate", letter: "Letter", payslip: "Payslip", contract: "Contract", other: "Other" };

type Loaded = { items: VaultDocument[]; used: number; limit: number; storageConfigured: boolean };

async function upload(form: FormData) {
  let response: Response;
  try { response = await fetch("/api/v1/vault", { method: "POST", body: form, credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(60000) }); }
  catch { throw new ApiRequestError("SERVICE_UNAVAILABLE", 503); }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const raw = body?.error?.code as ErrorCode;
    throw new ApiRequestError(Object.hasOwn(errorMessages, raw) ? raw : "INTERNAL_ERROR", response.status);
  }
  return body?.data;
}

// Private documents the person keeps as supporting evidence. Only the owner sees them; each download is a short-lived signed link.
export function EvidenceVault() {
  const { t } = useI18n();
  const [data, setData] = useState<Loaded | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false), [notice, setNotice] = useState("");
  const [title, setTitle] = useState(""), [category, setCategory] = useState<VaultCategory>("certificate"), [confirming, setConfirming] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null), key = useRef<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, EvidenceStatus>>({}), [statusKey, setStatusKey] = useState(0), hasDocuments = (data?.items.length ?? 0) > 0;
  // Revocation and correction notes are read only once there is at least one document, so an empty vault adds no reads.
  useEffect(() => {
    if (!hasDocuments) return;
    let active = true;
    appRequest("/api/v1/vault/status").then(raw => { if (active) setStatuses(Object.fromEntries(evidenceStatusList.parse(raw).items.map(item => [item.documentId, item]))); }).catch(() => undefined);
    return () => { active = false; };
  }, [hasDocuments, statusKey]);

  const fetchVault = useCallback(async (): Promise<Loaded> => {
    const raw = await appRequest("/api/v1/vault") as Record<string, unknown>;
    const parsed = vaultListResponse.parse({ items: raw.items, limit: raw.limit, used: raw.used });
    return { ...parsed, storageConfigured: raw.storageConfigured === true };
  }, []);
  const load = useCallback(async () => {
    try { setData(await fetchVault()); setError(""); } catch { setError("Your documents could not be loaded. Retry when connected."); }
  }, [fetchVault]);
  useEffect(() => {
    let active = true;
    fetchVault().then(value => { if (active) setData(value); }).catch(() => { if (active) setError("Your documents could not be loaded. Retry when connected."); });
    return () => { active = false; };
  }, [fetchVault]);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setNotice(""); setError("");
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Choose a PDF, PNG, JPEG or WebP file.");
    if (file.size > vaultLimits.maxBytes) return setError(`That file is larger than ${size(vaultLimits.maxBytes)}.`);
    setBusy(true);
    try {
      key.current ??= crypto.randomUUID();
      const form = new FormData();
      form.set("title", title.trim()); form.set("category", category); form.set("idempotencyKey", key.current); form.set("file", file);
      await upload(form);
      key.current = null; setTitle(""); if (fileRef.current) fileRef.current.value = "";
      setNotice("Document saved privately."); await load();
    } catch (caught) { setError(caught instanceof Error ? `${caught.message} Retry; the same upload is reused so it is not duplicated.` : "The document could not be saved."); }
    finally { setBusy(false); }
  }
  async function download(id: string) {
    setError("");
    try {
      const link = await appRequest(`/api/v1/vault/link?id=${id}`) as { url: string };
      const anchor = document.createElement("a"); anchor.href = link.url; anchor.rel = "noopener noreferrer"; document.body.append(anchor); anchor.click(); anchor.remove();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The download link could not be created."); }
  }
  async function remove(id: string) {
    setError(""); setBusy(true);
    try {
      const result = await appRequest("/api/v1/vault/delete", { documentId: id }) as { fileRemoved: boolean };
      setConfirming(null); setNotice(result.fileRemoved ? "Document deleted." : "Document deleted. Its stored file will be removed when storage is reachable."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The document could not be deleted."); }
    finally { setBusy(false); }
  }

  return <section className="fw-list-card" aria-label="Evidence Vault">
    <h3>{t("vault.title")}</h3>
    <p>{t("vault.intro")}</p>
    {data && !data.storageConfigured && <p role="note">Document storage is not set up on this server yet, so uploads are unavailable. Documents you already saved are not affected.</p>}
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    <form onSubmit={event => void submit(event)} aria-label="Add a document">
      <label className="fw-field">Document title<input value={title} maxLength={120} required onChange={event => setTitle(event.target.value)} /></label>
      <label className="fw-field">Type<select value={category} onChange={event => setCategory(event.target.value as VaultCategory)}>{vaultCategories.map(item => <option key={item} value={item}>{CATEGORY_LABEL[item]}</option>)}</select></label>
      <label className="fw-field">File (PDF, PNG, JPEG or WebP, up to {size(vaultLimits.maxBytes)})<input ref={fileRef} type="file" accept={accepted} required /></label>
      <button className="fw-primary" disabled={busy || !title.trim() || (data !== null && !data.storageConfigured)}>{busy ? "Working…" : t("vault.upload")}</button>
    </form>
    {!data && !error && <p role="status">Loading…</p>}
    {data?.items.length === 0 && <p>{t("vault.empty")}</p>}
    {data && data.items.length > 0 && <p>{data.used} of {data.limit} documents used.</p>}
    <ul>{data?.items.map(item => <li key={item.documentId}>
      <strong>{item.title}</strong> · {CATEGORY_LABEL[item.category]} · {item.fileName} · {size(item.byteSize)} · {day(item.createdAt)} · <span title={item.sha256}>checksum {item.sha256.slice(0, 8)}…</span>
      <button type="button" className="fw-secondary" disabled={busy} onClick={() => void download(item.documentId)}>{t("vault.download")}</button>
      {confirming === item.documentId
        ? <span role="group" aria-label="Confirm deleting"> Delete permanently? <button type="button" className="fw-secondary" disabled={busy} onClick={() => void remove(item.documentId)}>Delete now</button><button type="button" className="fw-secondary" onClick={() => setConfirming(null)}>Keep</button></span>
        : <button type="button" className="fw-secondary" disabled={busy} onClick={() => setConfirming(item.documentId)}>{t("vault.delete")}</button>}
      <DocumentStatus documentId={item.documentId} title={item.title} status={statuses[item.documentId]} onChanged={async () => { setStatusKey(value => value + 1); }} />
    </li>)}</ul>
    <p>Files are checked by type and size, kept in private storage and never shown inside ORYQEN. They are not scanned for malware, so open downloads with care.</p>
  </section>;
}
