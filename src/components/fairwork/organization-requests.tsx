"use client";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { appRequest,ApiRequestError } from "@/features/authority/client";
import { organizationListSchema, organizationQueueSchema, type OrganizationList, type OrganizationQueue } from "@/features/authority/organization-schema";
import { organizationFormCommand, OrganizationFormError } from "@/features/authority/organization-form";

export function OrganizationRequests({ operator = false }: { operator?: boolean }) {
 const [page, setPage] = useState<OrganizationList | OrganizationQueue | null>(null);
 const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
 const [kind, setKind] = useState("new");
 const keys = useRef(new Map<string, string>());
 const serial=useRef(0);
 const endpoint = operator ? "/api/v1/operator/organization-requests" : "/api/v1/organizations";
 const refresh = useCallback(async (cursor: string | null = null) => {
  const ticket=++serial.current;setPage(null);setError("");
  const result = await appRequest(endpoint + (cursor ? `?cursor=${cursor}` : ""));
  if(ticket===serial.current)setPage((operator ? organizationQueueSchema : organizationListSchema).parse(result));
 }, [endpoint, operator]);
 useEffect(() => {
  let active = true;const ticket=++serial.current;
  appRequest(endpoint).then(raw => { if (active&&ticket===serial.current) setPage((operator ? organizationQueueSchema : organizationListSchema).parse(raw)); })
   .catch(e => { if (active&&ticket===serial.current) setError(e instanceof Error ? e.message : "Unable to load requests."); });
  return () => { active = false; };
 }, [endpoint, operator]);
 async function submit(event: FormEvent<HTMLFormElement>, requestId?: string) {
  event.preventDefault(); const form = event.currentTarget, data = new FormData(form);
  setBusy(true); setError(""); setMessage("");
  try {
   const body = organizationFormCommand(data, kind, requestId);
   const fingerprint = JSON.stringify(body);
   let key = keys.current.get(fingerprint);
   if (!key) { key = crypto.randomUUID(); keys.current.set(fingerprint, key); }
   await appRequest(endpoint, body, key); form.reset();
   setMessage(requestId ? "Independent decision recorded." : "Request saved. No employer authority has been granted.");
   await refresh();
  } catch (e) {
   if(e instanceof ApiRequestError&&[401,403].includes(e.status))setPage(null);
   if(e instanceof OrganizationFormError) {
    const control=form.elements.namedItem(e.field);
    if(control instanceof HTMLElement)control.focus();
   }
   setError(e instanceof Error ? e.message : "Unable to save request.");
  }
  finally { setBusy(false); }
 }
 async function appeal(event:FormEvent<HTMLFormElement>,requestId:string){
  event.preventDefault();const fields=new FormData(event.currentTarget),body={requestId,grounds:fields.get("grounds")};
  setBusy(true);setError("");setMessage("");
  try{
   const fingerprint=JSON.stringify(body);let key=keys.current.get(fingerprint);if(!key){key=crypto.randomUUID();keys.current.set(fingerprint,key);}
   await appRequest("/api/v1/organizations/appeals",body,key);
   setMessage("Linked appeal saved. The original rejection is retained; a different independent reviewer must decide.");
   await refresh();
  }catch(e){if(e instanceof ApiRequestError&&[401,403].includes(e.status))setPage(null);setError(e instanceof Error?e.message:"Unable to submit appeal.");}
  finally{setBusy(false);}
 }
 return <section className="fw-card" style={{ padding: 20 }} aria-label="Organization requests">
  <h3>{operator ? "Independent organization review" : "Organization membership"}</h3>
  <p>Current local authority uses synthetic evidence under demo-authority.v1. Approval here does not verify a real employer or legal identity.</p>
  {!operator && <form onSubmit={event => void submit(event)}>
   <label className="fw-field">Request type<select value={kind} onChange={e => setKind(e.target.value)}><option value="new">Request a new organization</option><option value="existing">Join an existing organization</option></select></label>
   {kind === "new" ? <label className="fw-field">Organization name<input name="companyName" maxLength={120} required /></label> : <label className="fw-field">Organization ID<input name="companyId" required /></label>}
   <label className="fw-field">Membership request statement<textarea name="statement" maxLength={500} required /></label>
   <p>Explain your authority to represent this organization. Do not include passwords, identity documents or sensitive personal information.</p>
   <button className="fw-primary" disabled={busy}>Request independent approval</button>
  </form>}
  {!page && !error && <p role="status">Loading organization requests…</p>}
  {page?.items.length === 0 && <p>No organization requests to display.</p>}
  {page?.items.map(item => <section className="fw-list-card" key={item.requestId}>
   <strong>{item.companyName ?? "Existing organization"}</strong>
   <p>{item.statement}</p>
   {item.parentRequestId&&<p>Appeal of request: <span style={{overflowWrap:"anywhere"}}>{item.parentRequestId}</span>. The previous decision remains unchanged.</p>}
   {"previousDecisionReason" in item&&item.previousDecisionReason&&<p>Original rejection rationale: {item.previousDecisionReason}</p>}
   {item.companyId && <p>Organization ID: <span style={{ overflowWrap: "anywhere" }}>{item.companyId}</span></p>}
   {"decision" in item && <><p>Status: {item.decision ?? "Pending independent review"}{item.decision === "approve" ? item.active ? " · Authority currently active" : " · Authority no longer active" : ""}</p>{item.reason && <p>{item.reason}</p>}</>}
   {"appealRequestId" in item&&item.appealRequestId&&<p>Linked appeal request: <span style={{overflowWrap:"anywhere"}}>{item.appealRequestId}</span></p>}
   {!operator&&"decision" in item&&item.decision==="reject"&&!item.parentRequestId&&!item.appealRequestId&&<details><summary>Appeal this rejection</summary>
    <form onSubmit={event=>void appeal(event,item.requestId)}>
     <label className="fw-field">Organization appeal grounds<textarea name="grounds" minLength={10} maxLength={500} required/></label>
     <p>One linked appeal is available. Explain the correction or new evidence without including identity documents or secrets. A different authorized reviewer is required.</p>
     <label><input type="checkbox" required/>I have reviewed the appeal and understand it does not grant membership.</label>
     <button className="fw-primary" disabled={busy}>Submit organization appeal</button>
    </form>
   </details>}
   {operator && "subjectId" in item && <form onSubmit={event => void submit(event, item.requestId)}>
    <p>Applicant: <span style={{ overflowWrap: "anywhere" }}>{item.subjectId}</span></p>
    <label className="fw-field">Decision<select name="decision"><option value="reject">Reject</option><option value="approve">Approve synthetic membership</option></select></label>
    <label className="fw-field">Current membership revision<input name="revision" type="number" min={0} defaultValue={0} required /></label>
    <label className="fw-field">Approval expires (within 30 days)<input name="expiry" type="datetime-local" /></label>
    <label className="fw-field">Reviewed synthetic evidence references<textarea name="evidence" placeholder="demo:local/independent-review" maxLength={1210}/></label>
    <label className="fw-field">Decision rationale<textarea name="reason" maxLength={500} required /></label>
    <label><input type="checkbox" required/>I have reviewed the applicant, evidence and decision and have no conflict of interest.</label>
    <button className="fw-primary" disabled={busy}>Record independent decision</button>
   </form>}
  </section>)}
  <button className="fw-secondary" disabled={busy} onClick={() => void refresh().catch(e => setError(e.message))}>Refresh organization requests</button>
  {page?.nextCursor && <button className="fw-secondary" disabled={busy} onClick={() => void refresh(page.nextCursor).catch(e => setError(e.message))}>Next requests</button>}
  {message && <p role="status">{message}</p>}{error && <p role="alert">{error}</p>}
 </section>;
}
