import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdirSync,writeFileSync } from "node:fs";
import path from "node:path";
import net from "node:net";
const require=createRequire(path.resolve("test-results/day4-postgres-tools/package.json"));
const native=path.resolve(path.dirname(require.resolve("@embedded-postgres/windows-x64")),"..","native","bin");
const directory=path.resolve(`test-results/audit-chain-postgres-${Date.now()}`);
mkdirSync(directory,{recursive:true});
const reserve=net.createServer();await new Promise(resolve=>reserve.listen(0,"127.0.0.1",resolve));
const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
async function command(file,args,log,env=process.env) {
 const child=spawn(file,args,{env,windowsHide:true,stdio:["ignore","pipe","pipe"]});let output="";
 for(const stream of [child.stdout,child.stderr])stream.on("data",data=>{output+=data;process.stdout.write(data);});
 const code=await new Promise((resolve,reject)=>{child.on("error",reject);child.on("exit",resolve);});
 writeFileSync(path.join(directory,log),output);if(code!==0)throw new Error(`${path.basename(file)} failed (${code}); ${directory}`);
}
const data=path.join(directory,"data");
await command(path.join(native,"initdb.exe"),["-D",data,"-U","postgres","--auth=trust","--no-locale","--encoding=UTF8"],"initdb.log");
let started=false;
try {
 await command(path.join(native,"pg_ctl.exe"),["-D",data,"-l",path.join(directory,"server.log"),"-o",`-h 127.0.0.1 -p ${port} -c cluster_name=fairwork_day4_disposable`,"-w","start"],"start.log");started=true;
 // Native Windows timezone-catalog I/O can exceed the generic 60s hook budget
 // during profile creation. Keep this allowance local to this fixture runner;
 // do not change application authorization, SQL or global test configuration.
 const args=["node_modules/vitest/vitest.mjs","run","tests/integration/audit-chain-timezone-migration-db.test.ts"];
 if(process.argv.includes('--extended-setup'))args.push('--hookTimeout=300000');
 await command(process.execPath,args,"tests.log",{...process.env,FAIRWORK_LOCAL_POSTGRES_PORT:String(port)});
 console.log(`Real PostgreSQL evidence: ${directory}`);
}finally{
 if(started)await command(path.join(native,"pg_ctl.exe"),["-D",data,"-w","-m","fast","stop"],"stop.log");
}
