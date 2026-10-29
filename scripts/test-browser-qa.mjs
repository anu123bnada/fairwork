import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

// Explicitly unset public settings at BUILD time: Next inlines NEXT_PUBLIC_*.
// Never move, rewrite or display .env.local. Never stop an existing server.
const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:"",NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"",APP_ORIGIN:"http://localhost:3000",FAIRWORK_DATA_MODE:"synthetic",AUTH_REGISTRATION_ENABLED:process.env.AUTH_REGISTRATION_ENABLED??"false",FAIRWORK_BROWSER_SMOKE:"1",NEXT_TELEMETRY_DISABLED:"1",PLAYWRIGHT_EXTERNAL_SERVER:"1"};
mkdirSync("test-results",{recursive:true});
const tsconfig=readFileSync("tsconfig.json","utf8");
const nextEnv=readFileSync("next-env.d.ts","utf8");
async function command(args,logFile) {
  const child=spawn(process.execPath,args,{env,stdio:["ignore","pipe","pipe"],windowsHide:true});
  let log="";for(const stream of [child.stdout,child.stderr])stream.on("data",data=>{log+=data;process.stdout.write(data);});
  const [code]=await once(child,"exit");writeFileSync(logFile,log);
  if(code!==0)throw new Error(`Local verification command failed (${code}). See ${logFile}`);
}
try {
  if(await fetch("http://127.0.0.1:3100",{signal:AbortSignal.timeout(1000)}).then(()=>true,()=>false))console.warn("NOTE: a development server is running on port 3100. It is left untouched; generated Next files are restored with retries afterward.");
  try {await fetch("http://127.0.0.1:3111",{signal:AbortSignal.timeout(1000)});throw new Error("Port 3111 is occupied; refusing to disturb its server.");}
  catch(error){if(error.message.startsWith("Port 3111"))throw error;}
  await command(["node_modules/next/dist/bin/next","build"],"test-results/day2-browser-build.log");
  const server=spawn(process.execPath,["node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","3111"],{env,stdio:["ignore","pipe","pipe"],windowsHide:true});
  let log="";for(const stream of [server.stdout,server.stderr])stream.on("data",data=>{log+=data;});
  try {
    let ready=false;
    for(let attempt=0;attempt<60;attempt++){
      if(server.exitCode!==null)throw new Error("Isolated server stopped before readiness.");
      try{ready=(await fetch("http://127.0.0.1:3111",{signal:AbortSignal.timeout(1000)})).ok;}catch{ /* Connection refusal is expected until this child server is ready. */ }
      if(ready)break;await new Promise(resolve=>setTimeout(resolve,500));
    }
    if(!ready)throw new Error("Isolated server not ready.");
    await command(["node_modules/@playwright/test/cli.js","test","--config=playwright.qa.config.ts",...process.argv.slice(2)],"test-results/day2-browser.log");
  }finally{writeFileSync("test-results/day2-browser-server.log",log);if(server.exitCode===null){const exited=once(server,"exit");server.kill();await exited;}}
} finally {
  // Next auto-adds dist-specific generated types. Remove only its temporary
  // include entry; preserve unrelated edits made while this script was running.
  // A development server on port 3100 can hold or rewrite the same generated
  // files at this moment, so every restore is retried and a failure is reported
  // (never silently left pointing at test-results/day2-next).
  const restore=async(file,content)=>{
    for(let attempt=1;attempt<=8;attempt++){
      try{writeFileSync(file,content);if(readFileSync(file,"utf8")===content)return;}
      catch(error){if(attempt===8){console.error(`WARNING: could not restore ${file} (${error.code??error.message}). Run: git checkout -- ${file}`);return;}}
      await new Promise(resolve=>setTimeout(resolve,400*attempt));
    }
  };
  const current=readFileSync("tsconfig.json","utf8");
  if(current!==tsconfig){
    const parsed=JSON.parse(current);parsed.include=parsed.include.filter(path=>!path.startsWith("test-results/day2-next/"));
    const original=JSON.parse(tsconfig);
    await restore("tsconfig.json",JSON.stringify(parsed)===JSON.stringify(original)?tsconfig:JSON.stringify(parsed,null,2)+"\n");
  }
  const generated=readFileSync("next-env.d.ts","utf8");
  if(generated.includes("test-results/day2-next/"))await restore("next-env.d.ts",nextEnv);
}
