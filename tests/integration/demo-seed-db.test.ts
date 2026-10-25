import { beforeAll, afterAll, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFile,readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { draftSave } from "../../src/features/offer/draft-schema";
import { employmentSave } from "../../src/features/work/employment-schema";
import { employmentPage } from "../../src/features/work/employment-schema";
import { draftPage } from "../../src/features/offer/draft-schema";

type Item={id:string;idempotencyKey:string;content:unknown};
const seed=JSON.parse(await readFile("scripts/demo-seed-data.json","utf8")) as {account:{email:string};employment:Item[];offerDrafts:Item[]};
const db=new PGlite(),actor=randomUUID();
async function rpc(fn:string,request:unknown){await db.exec("begin;set local role authenticated");try{
 await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:actor,role:"authenticated",aal:"aal1",is_anonymous:false})]);
 const result=await db.query<{data:unknown}>(`select api.${fn}($1::jsonb) data`,[JSON.stringify(request)]);await db.exec("commit");return result.rows[0]!.data;
}catch(error){await db.exec("rollback");throw error;}}
beforeAll(async()=>{
 await db.exec("create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;create function auth.jwt() returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;");
 for(const file of (await readdir('supabase/migrations')).sort())await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
 await db.query('insert into auth.users values($1)',[actor]);await db.query("insert into private.profiles(id,display_name) values($1,'[DEMO] Synthetic Worker')",[actor]);
},120000);
afterAll(()=>db.close());

it("seed data is labeled synthetic, self-reported and uses a reserved test domain",()=>{
 expect(seed.account.email.endsWith("@example.test")).toBe(true);
 const all=[...seed.employment,...seed.offerDrafts].map(i=>JSON.stringify(i.content));
 for(const text of all)expect(text).toContain("[DEMO");
 expect(JSON.stringify({...seed,label:""})).not.toMatch(/verified|password|secret|@(?!example\.test)[a-z0-9.-]+\.[a-z]{2,}/i);
 expect(new Set([...seed.employment,...seed.offerDrafts].flatMap(i=>[i.id,i.idempotencyKey])).size).toBe((seed.employment.length+seed.offerDrafts.length)*2);
});
it("every seeded payload is valid against the real API schemas and the real database function",async()=>{
 for(const e of seed.employment){const body={operation:"save",id:e.id,expectedRevision:0,idempotencyKey:e.idempotencyKey,content:e.content};
  expect(employmentSave.safeParse(body).success).toBe(true);expect(await rpc("employment_history",body)).toEqual({id:e.id,revision:1,saved:true});}
 for(const d of seed.offerDrafts){const body={operation:"save",id:d.id,expectedRevision:0,idempotencyKey:d.idempotencyKey,content:d.content};
  expect(draftSave.safeParse(body).success).toBe(true);expect(await rpc("offer_drafts",body)).toEqual({id:d.id,revision:1,saved:true});}
});
it("re-running the seed replays idempotently without duplicates",async()=>{
 for(const e of seed.employment)expect(await rpc("employment_history",{operation:"save",id:e.id,expectedRevision:0,idempotencyKey:e.idempotencyKey,content:e.content})).toMatchObject({revision:1});
 for(const d of seed.offerDrafts)expect(await rpc("offer_drafts",{operation:"save",id:d.id,expectedRevision:0,idempotencyKey:d.idempotencyKey,content:d.content})).toMatchObject({revision:1});
 const jobs=employmentPage.parse(await rpc("employment_history",{operation:"list",cursor:null})).items;
 expect(jobs).toHaveLength(seed.employment.length);expect(jobs.every(j=>j.revision===1&&j.verification==="self_reported")).toBe(true);
 expect(draftPage.parse(await rpc("offer_drafts",{operation:"list",cursor:null})).items).toHaveLength(seed.offerDrafts.length);
});
