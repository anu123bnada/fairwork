// Local source packaging only: no CLI login/link/deploy or environment copying.
import { mkdirSync, readFileSync, readdirSync, writeFileSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root=process.cwd(), destination=path.resolve(`test-results/staging-package-${Date.now()}`);
const files=['package.json','package-lock.json','next.config.ts','next-env.d.ts','tsconfig.json','eslint.config.mjs'];
for(const base of ['src','public']) {
  const visit=relative=>{
    for(const entry of readdirSync(relative,{withFileTypes:true})) {
      const child=path.join(relative,entry.name);
      if(entry.isSymbolicLink())throw new Error('STOP: source package contains a symbolic link');
      if(entry.isDirectory())visit(child);else if(entry.isFile())files.push(child);
    }
  };
  visit(base);
}
const manifest=[];
for(const relative of files) {
  if (/(^|[\\/])\.env(?:[.\\/]|$)|\.(?:pem|key|p12|pfx|jks|keystore|dump|backup)$/i.test(relative)) throw new Error('STOP: sensitive file type in deployment allowlist');
  const source=path.resolve(root,relative), target=path.resolve(destination,relative);
  if(!target.startsWith(destination+path.sep)||lstatSync(source).isSymbolicLink()) throw new Error('STOP: invalid source path');
  const bytes=readFileSync(source);mkdirSync(path.dirname(target),{recursive:true});writeFileSync(target,bytes,{flag:'wx'});
  manifest.push({path:relative.replaceAll('\\','/'),sha256:createHash('sha256').update(bytes).digest('hex')});
}
// Exclude local platform state if the package is subsequently linked by its owner.
writeFileSync(path.join(destination,'.vercelignore'),'.env*\n.vercel\nnode_modules\n.next\n*.log\n');
writeFileSync(`${destination}.manifest.json`,JSON.stringify({createdAt:new Date().toISOString(),status:'LOCAL_PACKAGE_NOT_DEPLOYED',files:manifest},null,2));
console.log(JSON.stringify({status:'LOCAL_PACKAGE_NOT_DEPLOYED',directory:destination,manifest:`${destination}.manifest.json`,files:manifest.length,environmentFilesCopied:0}));
