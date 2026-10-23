// Copy pinned, self-hosted runtime assets only. Never handles user images.
import { readFileSync,writeFileSync,mkdirSync,existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const files=[
 ['tesseract.js/dist/tesseract.min.js','tesseract.min.js'],
 ['tesseract.js/dist/worker.min.js','worker.min.js'],
 ['tesseract.js/dist/worker.min.js.LICENSE.txt','worker.min.js.LICENSE.txt'],
 ['tesseract.js/dist/tesseract.min.js.LICENSE.txt','tesseract.min.js.LICENSE.txt'],
 ['tesseract.js/LICENSE.md','TESSERACT-LICENSE.txt'],
 ['tesseract.js-core/LICENSE','CORE-LICENSE.txt'],
 ['@tesseract.js-data/eng/package.json','ENGLISH-PACKAGE.json'],
 ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','eng.traineddata.gz'],
 ...['','-simd','-relaxedsimd'].map(suffix=>[`tesseract.js-core/tesseract-core${suffix}-lstm.wasm.js`,`tesseract-core${suffix}-lstm.wasm.js`]),
];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const directory='public/ocr/vendor';mkdirSync(directory,{recursive:true});
const manifest=[];
for(const [source,name] of files){
 const bytes=readFileSync(`node_modules/${source}`),target=`${directory}/${name}`;
 if(existsSync(target)&&hash(readFileSync(target))!==hash(bytes))throw new Error('OCR artifact changed; review before replacing '+name);
 writeFileSync(target,bytes);manifest.push({source,name,bytes:bytes.length,sha256:hash(bytes)});
}
writeFileSync(`${directory}/manifest.json`,JSON.stringify({tesseract:'7.0.0',english:'1.0.0',files:manifest},null,2));
console.log('PASS: self-hosted OCR artifacts prepared; '+manifest.reduce((n,f)=>n+f.bytes,0)+' bytes; no document processed');
