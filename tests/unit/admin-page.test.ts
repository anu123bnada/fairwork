import {beforeEach,expect,it,vi} from "vitest";
import {AppError} from "@/lib/errors";
const mocks=vi.hoisted(()=>({service:vi.fn(),runtime:vi.fn(()=>({provider:"gemini"}))}));
vi.mock("@/server/admin",()=>({adminService:mocks.service,adminRuntime:mocks.runtime}));
vi.mock("next/navigation",()=>({notFound:()=>{throw new Error("NOT_FOUND");}}));
vi.mock("@/components/admin/admin-center",()=>({AdminCenter:()=>null,AdminAccess:()=>null}));
import Page from "@/app/admin/[[...section]]/page";
const target="50000000-0000-4000-8000-000000000001";
const initial={role:"auditor",items:[],nextCursor:null,metrics:null,trend:null,dataMode:"synthetic"};
const visit=(search:Record<string,string|string[]|undefined>,section=["audit"])=>Page({params:Promise.resolve({section}),searchParams:Promise.resolve(search)});
beforeEach(()=>{vi.clearAllMocks();mocks.service.mockResolvedValue(initial);});
it("passes a deep-linked audit target through authorization and the initial client filter",async()=>{
 const result=await visit({target});
 expect(mocks.service).toHaveBeenCalledWith("admin_read",expect.objectContaining({resource:"audit",search:target,cursor:null}),false);
 expect(result.props.initialQuery.search).toBe(target);
 expect(result.key).toBe(`audit:${target}`);
 const second=await visit({target:"50000000-0000-4000-8000-000000000002"});
 expect(second.key).not.toBe(result.key);
});
it("rejects malformed or repeated audit targets before reading any records",async()=>{
 for(const value of ["not-a-uuid","",[target,target]])await expect(visit({target:value})).rejects.toThrow("NOT_FOUND");
 expect(mocks.service).not.toHaveBeenCalled();expect(mocks.runtime).not.toHaveBeenCalled();
});
it("targeted audit links cannot bypass the database access gate",async()=>{
 mocks.service.mockRejectedValue(new AppError("ACTION_FORBIDDEN",403));
 const result=await visit({target});
 expect(result.props.initial).toBeUndefined();expect(result.props.message).toBeTruthy();
 expect(mocks.runtime).not.toHaveBeenCalled();
});
it("preserves normal directory queries and the separate caseId navigation contract",async()=>{
 await visit({caseId:target},["cases"]);
 expect(mocks.service).toHaveBeenCalledWith("admin_read",expect.objectContaining({resource:"cases",search:""}),false);
});
it("filters observed security activity by validated account UUID",async()=>{
 const result=await visit({target},["telemetry"]);expect(result.props.initialQuery.search).toBe(target);
 expect(mocks.service).toHaveBeenCalledWith("admin_read",expect.objectContaining({resource:"telemetry",search:target}),false);
 await expect(visit({target:"invalid"},["telemetry"])).rejects.toThrow("NOT_FOUND");
});
