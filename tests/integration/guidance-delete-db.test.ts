import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile,readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { guidanceDeleteReceipt,guidancePage } from "../../src/features/guidance/schema";
const db=new PGlite(),owner=randomUUID(),other=randomUUID(),thread=randomUUID(),otherThread=randomUUID();
async function rpc(fn:string,request:unknown,actor=owner){await db.exec("begin;set local role authenticated");try{
 await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor,role:"authenticated",aal:"aal1",is_anonymous:false})]);
 const result=await db.query<{data:unknown}>(`select api.${fn}($1::jsonb) data`,[JSON.stringify(request)]);await db.exec("commit");return result.rows[0]!.data;
}catch(error){await db.exec("rollback");throw error;}}
const send=(threadId:string,question:string,actor=owner)=>rpc("guidance",{operation:"send",threadId,question,topic:"offer",offerId:null,idempotencyKey:randomUUID()},actor);
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;");
 for(const file of (await readdir('supabase/migrations')).sort())await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
 for(const actor of [owner,other]){await db.query('insert into auth.users values($1)',[actor]);await db.query("insert into private.profiles(id,display_name) values($1,'Synthetic guidance user')",[actor]);}
},120000);
afterAll(()=>db.close());

it("deletes only the caller's conversation, keeps others, and leaves a content-free receipt",async()=>{
 await send(thread,"First private question");await send(thread,"Second private question");await send(otherThread,"Other user's question",other);
 const receipt=guidanceDeleteReceipt.parse(await rpc("guidance_delete",{operation:"delete",threadId:thread}));
 expect(receipt).toEqual({threadId:thread,deleted:2});
 expect(guidancePage.parse(await rpc("guidance",{operation:"read",threadId:thread})).turns).toEqual([]);
 expect(guidancePage.parse(await rpc("guidance",{operation:"read",threadId:otherThread},other)).turns).toHaveLength(1);
 const remaining=await db.query<{n:number}>("select count(*)::int n from private.guidance_turns where question like '%private question%'");
 expect(remaining.rows[0]!.n).toBe(0);
 const receipts=await db.query<Record<string,unknown>>("select * from private.guidance_deletions");
 expect(receipts.rows).toHaveLength(1);expect(Object.keys(receipts.rows[0]!).sort()).toEqual(["actor_id","deleted_at","id","thread_id","turn_count"]);
 expect(receipts.rows[0]).toMatchObject({actor_id:owner,thread_id:thread,turn_count:2});
});
it("cannot delete another user's conversation and treats an unknown thread as empty",async()=>{
 expect(await rpc("guidance_delete",{operation:"delete",threadId:otherThread})).toEqual({threadId:otherThread,deleted:0});
 expect(guidancePage.parse(await rpc("guidance",{operation:"read",threadId:otherThread},other)).turns).toHaveLength(1);
 expect(await rpc("guidance_delete",{operation:"delete",threadId:randomUUID()})).toMatchObject({deleted:0});
 expect((await db.query<{n:number}>("select count(*)::int n from private.guidance_deletions")).rows[0]!.n).toBe(1);
});
it("history stays append-only outside the delete function and rejects bad or inactive requests",async()=>{
 await expect(db.exec("delete from private.guidance_turns")).rejects.toThrow("ACTION_FORBIDDEN");
 await expect(db.exec("update private.guidance_turns set question='changed'")).rejects.toThrow("ACTION_FORBIDDEN");
 await expect(db.exec("delete from private.guidance_deletions")).rejects.toThrow("ACTION_FORBIDDEN");
 for(const request of [{operation:"delete"},{operation:"delete",threadId:null},{operation:"delete",threadId:"x"},{operation:"delete",threadId:thread,actorId:other},{operation:"remove",threadId:thread}])await expect(rpc("guidance_delete",request)).rejects.toThrow("VALIDATION_FAILED");
 const flag=await db.query<{v:string|null}>("select current_setting('oryqen.guidance_erase',true) v");expect(["off","",null]).toContain(flag.rows[0]!.v);
 await db.query("update private.profiles set account_state='suspended' where id=$1",[other]);
 await expect(rpc("guidance_delete",{operation:"delete",threadId:otherThread},other)).rejects.toThrow("AUTH_REQUIRED");
 const access=await db.query("select relrowsecurity,relforcerowsecurity,has_table_privilege('authenticated',oid,'DELETE') d from pg_class where oid='private.guidance_deletions'::regclass");
 expect(access.rows[0]).toEqual({relrowsecurity:true,relforcerowsecurity:true,d:false});
});
