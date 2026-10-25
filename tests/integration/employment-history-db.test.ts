import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile,readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { employmentPage } from "../../src/features/work/employment-schema";
const db=new PGlite(),owner=randomUUID(),other=randomUUID(),id=randomUUID();
async function rpc(request:unknown,actor=owner){await db.exec("begin;set local role authenticated");try{
 await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor,role:"authenticated",aal:"aal1",is_anonymous:false})]);
 const result=await db.query<{data:unknown}>("select api.employment_history($1::jsonb) data",[JSON.stringify(request)]);await db.exec("commit");return result.rows[0]!.data;
}catch(error){await db.exec("rollback");throw error;}}
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;");
 for(const file of (await readdir('supabase/migrations')).sort())await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
 for(const actor of [owner,other]){await db.query('insert into auth.users values($1)',[actor]);await db.query("insert into private.profiles(id,display_name) values($1,'Synthetic history owner')",[actor]);}
},120000);
afterAll(()=>db.close());
const content={employer:"Synthetic Works Ltd",role:"Technician",startDate:"2021-03",endDate:null,current:true,skills:["Welding","Safety"],achievements:"Synthetic achievement"};
const save={operation:"save",id,expectedRevision:0,idempotencyKey:randomUUID(),content};
it("saves, versions, deduplicates retries and labels entries self-reported",async()=>{
 expect(await rpc(save)).toEqual({id,revision:1,saved:true});expect(await rpc(save)).toEqual({id,revision:1,saved:true});
 await expect(rpc({...save,content:{...content,role:"Changed"}})).rejects.toThrow("IDEMPOTENCY_CONFLICT");
 await expect(rpc({...save,idempotencyKey:randomUUID()})).rejects.toThrow("VERSION_CONFLICT");
 const edited={...content,current:false,endDate:"2023-06"};
 expect(await rpc({...save,expectedRevision:1,idempotencyKey:randomUUID(),content:edited})).toMatchObject({revision:2});
 expect(employmentPage.parse(await rpc({operation:"list",cursor:null})).items).toMatchObject([{id,revision:2,content:edited,verification:"self_reported"}]);
});
it("isolates users and rejects invalid direct payloads including forged verification",async()=>{
 expect(employmentPage.parse(await rpc({operation:"list",cursor:null},other)).items).toEqual([]);
 await expect(rpc({...save,expectedRevision:2,idempotencyKey:randomUUID()},other)).rejects.toThrow("VERSION_CONFLICT");
 const bad=[{...content,verified:true},{...content,current:true,endDate:"2022-01"},{...content,current:false,endDate:null},{...content,current:false,endDate:"2020-01"},{...content,startDate:"2021-13"},{...content,skills:Array(21).fill("x")},{...content,skills:[1]},{...content,employer:" "}];
 for(const c of bad)await expect(rpc({...save,id:randomUUID(),idempotencyKey:randomUUID(),content:c})).rejects.toThrow("VALIDATION_FAILED");
 await expect(rpc({...save,actorId:other})).rejects.toThrow("VALIDATION_FAILED");
 await db.query("update private.profiles set account_state='suspended' where id=$1",[other]);
 await expect(rpc({operation:"list",cursor:null},other)).rejects.toThrow("AUTH_REQUIRED");
});
it("has forced RLS, no direct client grant and immutable revision history",async()=>{
 const result=await db.query("select relrowsecurity,relforcerowsecurity,has_table_privilege('authenticated',oid,'SELECT') readable from pg_class where oid='private.employment_history_revisions'::regclass");
 expect(result.rows[0]).toEqual({relrowsecurity:true,relforcerowsecurity:true,readable:false});
 await expect(db.exec("delete from private.employment_history_revisions")).rejects.toThrow();
});
