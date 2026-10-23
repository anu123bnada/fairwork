import { expect, it } from "vitest";
import { privatePassportExport, collectPrivatePassportExport } from "@/features/work/passport-export";
const id="40000000-0000-4000-8000-000000000001", time="2026-10-18T00:00:00Z", hash="a".repeat(64);
const passport={policyVersion:"private-work-passport.v1",passportId:id,ownerId:id,createdAt:time,nextCursor:id,entries:[{workId:id,version:1,role:"Technician",periodStart:"2026-10-16",periodEnd:"2026-10-16",hours:"8",summary:"Maintenance",companyId:id,companyName:"Synthetic",agreementId:id,agreementVersion:1,agreementHash:hash,agreementEffectiveAt:time,verificationId:id,verifiedAt:time,verifierId:id,authorityDecisionId:id,evidenceCount:1,evidenceHash:hash}]};
it("downloads only explicit personal fields, with pagination and stale-copy disclosure",()=>{
 const data=privatePassportExport(passport,time);
 expect(data.moreRecordsAvailable).toBe(true);
 const first=data.records[0];if(!first)throw new Error("Expected the eligible fixture record");
 expect(Object.keys(first).sort()).toEqual(["companyName","hours","periodEnd","periodStart","revision","role","summary","verifiedAt"]);
 expect(JSON.stringify(data)).not.toContain(id);expect(JSON.stringify(data)).not.toContain(hash);
 expect(data.notice).toContain("cannot be revoked");
});
it("collects independently authorized pages without exposing identifiers",async()=>{
 const secondId="40000000-0000-4000-8000-000000000002";
 const cursors:(string|null)[]=[];
 const result=await collectPrivatePassportExport(async cursor=>{cursors.push(cursor);return cursor?{...passport,nextCursor:null,entries:[{...passport.entries[0],workId:secondId,role:"Second role"}]}:passport;},time);
 expect(cursors).toEqual([null,id]);expect(result.records).toHaveLength(2);
 expect(result.moreRecordsAvailable).toBe(false);expect(result.notice).toContain("not an atomic snapshot");
 expect(JSON.stringify(result)).not.toContain(id);expect(JSON.stringify(result)).not.toContain(secondId);
});
it("rejects a denied later page and identity changes without returning partial data",async()=>{
 await expect(collectPrivatePassportExport(async cursor=>{if(cursor)throw new Error("NOT_FOUND");return passport;},time)).rejects.toThrow("NOT_FOUND");
 await expect(collectPrivatePassportExport(async cursor=>cursor?{...passport,ownerId:"40000000-0000-4000-8000-000000000002"}:passport,time)).rejects.toThrow("changed");
});
it("rejects duplicate rows and cyclic cursors",async()=>{
 await expect(collectPrivatePassportExport(async()=>passport,time)).rejects.toThrow("changed");
 await expect(collectPrivatePassportExport(async()=>({...passport,entries:[]}),time)).rejects.toThrow("did not advance");
});
it("bounds work and rejects oversized downloads rather than silently truncating",async()=>{
 let calls=0;
 await expect(collectPrivatePassportExport(async()=>({...passport,entries:[],nextCursor:`40000000-0000-4000-8000-${String(++calls).padStart(12,"0")}`}),time)).rejects.toThrow("limit");
 expect(calls).toBe(50);
});
it("fails closed when the transport gains unknown private fields",()=>{
 expect(()=>privatePassportExport({...passport,entries:[{...passport.entries[0],rawEvidence:"SECRET"}]},time)).toThrow();
});
