import { expect,it } from "vitest";
import { notificationCursor,notificationRead,notificationList } from "@/features/identity/notifications-schema";
it("rejects caller-selected recipients and partial cursors",()=>{
 expect(notificationRead.safeParse({eventKey:"offer:example:1",subjectId:"other"}).success).toBe(false);
 expect(notificationCursor.safeParse({cursorKey:"x"}).success).toBe(false);
});
it("does not accept notification links to external or arbitrary application locations",()=>{
 for(const href of ["https://example.test","javascript:alert(1)","/api/v1/me"]){
  expect(notificationList.safeParse({items:[{eventKey:"x",kind:"organization_decision",title:"x",href,recordedAt:"2026-10-18T00:00:00Z",read:false}],nextCursor:null}).success).toBe(false);
 }
});
