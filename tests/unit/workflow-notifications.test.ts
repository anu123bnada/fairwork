import {expect,it} from "vitest";
import {notificationList} from "@/features/identity/notifications-schema";
const id="40000000-0000-4000-8000-000000000001";
const event={eventKey:`work:${id}`,kind:"work_decision",title:"Work revision 1 verified",href:`/app/work-record?workId=${id}`,recordedAt:"2026-10-19T00:00:00Z",read:false};
it("accepts the narrow workflow link projection",()=>{
 for(const [kind,href] of [["agreement_decision",`/app/agreement-workflow?workflowId=${id}`],["work_decision",event.href],["work_integrity",event.href]])expect(notificationList.safeParse({items:[{...event,kind,href}],nextCursor:null}).success).toBe(true);
});
it("denies external links, extra authority and sensitive evidence in notifications",()=>{
 for(const invalid of [{...event,href:"https://example.test"},{...event,href:`/app/work-record?workId=${id}&admin=true`},{...event,reason:"private reason"},{...event,evidence:"private evidence"}])expect(notificationList.safeParse({items:[invalid],nextCursor:null}).success).toBe(false);
});
