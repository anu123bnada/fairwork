// This parent owns the OCR child so termination also ends its dedicated workers.
// No document URLs, logs, caches, uploads or third-party asset requests.
self.importScripts('/ocr/vendor/tesseract.min.js');
self.onmessage = async event => {
 let engine;
 try {
  engine = await self.Tesseract.createWorker('eng',1,{
   workerPath:new URL('/ocr/vendor/worker.min.js',self.location.origin).href,
   corePath:new URL('/ocr/vendor',self.location.origin).href,
   langPath:new URL('/ocr/vendor',self.location.origin).href,
   workerBlobURL:false,cacheMethod:'none',gzip:true,logging:false,
   errorHandler:()=>{},
  });
  const result=await engine.recognize(event.data);
  const text=result.data.text.trim();
  if(!text||text.length>10000)throw new Error('Unusable text');
  self.postMessage({text});
 }catch{self.postMessage({error:'Text could not be read. Try a clearer English screenshot or enter the terms manually.'});}
 finally{if(engine)await engine.terminate();self.close();}
};
