import { _electron as electron } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
const executablePath=path.resolve('test-results/windows-artifacts/win-unpacked/ORYQEN Preview.exe');
const result={launch:false,sandbox:false,resize:false,minimize:false,maximize:false,networkRecovery:false,sessionAcceptance:'NOT TESTED — no real login/email authorized'};
mkdirSync('test-results/desktop-smoke',{recursive:true});
const application=await electron.launch({executablePath,timeout:60000});
try {
 const page=await application.firstWindow(); result.launch=true;
 const preferences=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences());
 result.sandbox=preferences.sandbox===true&&preferences.contextIsolation===true&&preferences.nodeIntegration===false;
 if(!result.sandbox)throw new Error('Unsafe renderer preferences');
 await application.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.setSize(480,760);});
 result.resize=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getSize()[0]===480);
 await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].minimize());
 result.minimize=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMinimized());
 await application.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.restore();win.maximize();});
 result.maximize=await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMaximized());
 await application.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.restore();win.show();win.focus();});
 await application.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].webContents.emit('did-fail-load',{},-105,'Synthetic network error','https://oryqen.vercel.app/sign-in',true);});
 await page.getByRole('heading',{name:'Connection unavailable'}).waitFor();result.networkRecovery=true;
 await page.screenshot({path:'test-results/desktop-smoke/offline.png'});
 if(!result.resize||!result.minimize||!result.maximize)throw new Error('Window controls did not reach expected states');
} finally {writeFileSync('test-results/desktop-smoke/results.json',JSON.stringify(result,null,2));await application.close();}
console.log(JSON.stringify(result));
