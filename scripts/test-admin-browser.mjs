import {createServer} from "vite";
import {spawn} from "node:child_process";
import {mkdirSync,writeFileSync} from "node:fs";
import path from "node:path";
const server=await createServer({configFile:false,root:path.resolve("tests/admin-browser"),cacheDir:path.resolve("test-results/admin-vite-cache"),resolve:{alias:{"@":path.resolve("src"),"next/image":path.resolve("tests/admin-browser/next-image.tsx"),"next/link":path.resolve("tests/admin-browser/next-link.tsx"),"next/navigation":path.resolve("tests/admin-browser/next-navigation.ts")}},esbuild:{jsx:"automatic"},server:{host:"127.0.0.1",port:3113,strictPort:true,fs:{allow:[process.cwd()]}}});
await server.listen();mkdirSync("test-results",{recursive:true});
try{const child=spawn(process.execPath,["node_modules/@playwright/test/cli.js","test","--config=playwright.admin.config.ts"],{windowsHide:true,stdio:["ignore","pipe","pipe"]});let output="";for(const stream of [child.stdout,child.stderr])stream.on("data",data=>{output+=data;process.stdout.write(data);});const code=await new Promise((resolve,reject)=>{child.on("error",reject);child.on("exit",resolve);});writeFileSync("test-results/stage10-admin-browser.log",output);if(code!==0)process.exitCode=1;}finally{await server.close();}
