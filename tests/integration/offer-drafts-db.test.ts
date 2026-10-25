import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile,readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { draftPage } from "../../src/features/offer/draft-schema";
const db=new PGlite(),owner=randomUUID(),other=randomUUID(),id=randomUUID();
async function rpc(request:unknown,actor=owner){await db.exec("begin;set local role authenticated");try{
 await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor,role:"authenticated",aal:"aal1",is_anonymous:false})]);
 const result=await db.query<{data:unknown}>("select api.offer_drafts($1::jsonb) data",[JSON.stringify(request)]);await db.exec("commit");return result.rows[0]!.data;
}catch(error){await db.exec("rollback");throw error;}}
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;");
 for(const file of (await readdir('supabase/migrations')).sort())await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
 for(const actor of [owner,other]){await db.query('insert into auth.users values($1)',[actor]);await db.query("insert into private.profiles(id,display_name) values($1,'Synthetic draft owner')",[actor]);}
},120000);
afterAll(()=>db.close());
const save={operation:"save",id,expectedRevision:0,idempotencyKey:randomUUID(),content:{role:"Technician",employer:"Reported employer",text:"Pay not yet agreed"}};
it("saves without an organization, persists across transactions, versions and deduplicates retries",async()=>{
 expect(await rpc(save)).toEqual({id,revision:1,saved:true});expect(await rpc(save)).toEqual({id,revision:1,saved:true});
 expect(draftPage.parse(await rpc({operation:"list",cursor:null})).items).toMatchObject([{id,revision:1,content:save.content}]);
 await expect(rpc({...save,content:{...save.content,role:"Changed"}})).rejects.toThrow("IDEMPOTENCY_CONFLICT");
 await expect(rpc({...save,idempotencyKey:randomUUID()})).rejects.toThrow("VERSION_CONFLICT");
 expect(await rpc({...save,expectedRevision:1,idempotencyKey:randomUUID(),content:{...save.content,text:"Updated notes"}})).toMatchObject({revision:2});
});
it("isolates users, rejects malformed direct RPC payloads and denies suspended access",async()=>{
 expect(draftPage.parse(await rpc({operation:"list",cursor:null},other)).items).toEqual([]);
 await expect(rpc({...save,expectedRevision:2,idempotencyKey:randomUUID()},other)).rejects.toThrow("VERSION_CONFLICT");
 for(const request of [{...save,actorId:other},{...save,content:{...save.content,verified:true}},{...save,expectedRevision:null},{operation:"list",cursor:12}])await expect(rpc(request)).rejects.toThrow("VALIDATION_FAILED");
 await db.query("update private.profiles set account_state='suspended' where id=$1",[other]);
 await expect(rpc({operation:"list",cursor:null},other)).rejects.toThrow("AUTH_REQUIRED");
});
it("has forced RLS, no direct client grant and immutable revision history",async()=>{
 const result=await db.query("select relrowsecurity,relforcerowsecurity,has_table_privilege('authenticated',oid,'SELECT') readable from pg_class where oid='private.offer_draft_revisions'::regclass");
 expect(result.rows[0]).toEqual({relrowsecurity:true,relforcerowsecurity:true,readable:false});
 await expect(db.exec("delete from private.offer_draft_revisions")).rejects.toThrow();
});
