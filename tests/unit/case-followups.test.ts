import {it,expect} from "vitest";
import {followupCommand,followupRead,followupReceipt} from "@/features/cases/followup-schema";
import {notificationList} from "@/features/identity/notifications-schema";
const id="50000000-0000-4000-8000-000000000001";
it("denies forged identity, invalid revision and short correspondence",()=>{
 const command={caseId:id,operation:"appeal",expectedRevision:4,message:"Synthetic appeal grounds"};expect(followupCommand.safeParse(command).success).toBe(true);
 for(const fields of [{actorId:id},{expectedRevision:0},{message:"x"},{operation:"rewrite_resolution"}])expect(followupCommand.safeParse({...command,...fields}).success).toBe(false);
 expect(followupRead.safeParse({caseId:id,ownerId:id}).success).toBe(false);expect(followupReceipt.safeParse({eventId:id,caseId:id,linkedCaseId:null}).success).toBe(true);
});
it("allows only scoped local case notification links",()=>{
 const event={eventKey:`case-followup:${id}`,kind:"case_followup",title:"Case response",href:`/app/cases?caseId=${id}`,recordedAt:"2026-10-20T00:00:00Z",read:false};expect(notificationList.safeParse({items:[event],nextCursor:null}).success).toBe(true);expect(notificationList.safeParse({items:[{...event,href:"https://external.test"}],nextCursor:null}).success).toBe(false);
});
