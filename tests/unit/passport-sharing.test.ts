import { expect,it } from "vitest";
import { shareCommand,shareProjection } from "@/features/work/sharing-schema";
const id="40000000-0000-4000-8000-000000000001";
it("sharing accepts only explicitly registered fields and denies trusted identity injection",()=>{
 const selection={operation:"select",itemId:id,workId:id,workVersion:1,summary:"Explicitly shared task description",fields:["task_summary"]};
 expect(shareCommand.safeParse(selection).success).toBe(true);
 for(const fields of [["salary"],["raw_evidence"],["*"],["task_summary","task_summary"]])expect(shareCommand.safeParse({...selection,fields}).success).toBe(false);
 expect(shareCommand.safeParse({...selection,workerId:id}).success).toBe(false);
});
it("new private DTO fields cannot silently widen recipient output",()=>{
 const output={projectionVersion:"passport.v1",grantId:id,expiresAt:"2026-10-19T00:00:00Z",active:true,entries:[{task_summary:"Owner summary"}]};
 expect(shareProjection.safeParse(output).success).toBe(true);
 for(const extra of [{salary:"80000"},{evidence:"private"},{workerId:id},{reason:"private dispute"}])expect(shareProjection.safeParse({...output,entries:[{...output.entries[0],...extra}]}).success).toBe(false);
});
