import { expect, it } from "vitest";
import { organizationFormCommand, OrganizationFormError } from "@/features/authority/organization-form";
const id = "40000000-0000-4000-8000-000000000012";
const now = Date.parse("2026-10-22T12:00:00Z");
function form(values: Record<string,string>) { const data=new FormData(); for(const [k,v] of Object.entries(values))data.set(k,v); return data; }
const approval={decision:"approve",revision:"2",expiry:"2026-10-23T12:00:00Z",reason:"Reviewed independently",evidence:"demo:local/review"};
it("rejects missing, invalid, expired or overlong approval dates with actionable feedback",()=>{
 for(const expiry of ["","invalid","2026-10-20T12:00:00Z","2026-12-22T12:00:00Z"]){
  try{organizationFormCommand(form({...approval,expiry}),"new",id,now);throw new Error("Expected denial");}
  catch(error){expect(error).toBeInstanceOf(OrganizationFormError);expect(error).toMatchObject({field:"expiry"});}
 }
});
it("requires actual reviewed evidence and an explicit integer revision",()=>{
 for(const evidence of ["","https://example.test/id","demo:",Array(11).fill("demo:local/review").join("\n")])expect(()=>organizationFormCommand(form({...approval,evidence}),"new",id,now)).toThrow(/evidence/);
 for(const revision of ["","NaN","-1","1.5"])expect(()=>organizationFormCommand(form({...approval,revision}),"new",id,now)).toThrow(/revision/);
});
it("normalizes approved input without trusting client identity or authority",()=>{
 expect(organizationFormCommand(form({...approval,subjectId:id,approved:"true",evidence:" demo:local/review \n"}),"new",id,now)).toEqual({requestId:id,decision:"approve",reason:approval.reason,expectedRevision:2,expiresAt:"2026-10-23T12:00:00.000Z",reviewedEvidenceRefs:["demo:local/review"]});
});
it("allows rejection without approval-only fields",()=>{
 expect(organizationFormCommand(form({...approval,decision:"reject",expiry:"",evidence:""}),"new",id,now)).toMatchObject({decision:"reject",expiresAt:null,reviewedEvidenceRefs:[]});
});
it("rejects malformed organization IDs and whitespace-only requests",()=>{
 expect(()=>organizationFormCommand(form({companyId:"not-an-id",statement:"request"}),"existing")).toThrow(/organization ID/);
 expect(()=>organizationFormCommand(form({companyName:"  ",statement:"request"}),"new")).toThrow(/organization name/);
 expect(()=>organizationFormCommand(form({companyName:"Example",statement:"  "}),"new")).toThrow(/statement/);
 expect(organizationFormCommand(form({companyId:` ${id} `,statement:" Independent request "}),"existing")).toEqual({companyId:id,companyName:null,statement:"Independent request"});
});
