// Reject oversized declared raster dimensions before browser decoding allocates pixels.
export function screenshotDimensions(bytes:Uint8Array,type:string){
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 let width=0,height=0;
 if(type==="image/png"){
  if(bytes.length<24||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)||String.fromCharCode(...bytes.slice(12,16))!=="IHDR")throw new Error("The image contents do not match its file type.");
  width=view.getUint32(16);height=view.getUint32(20);
 }else if(type==="image/jpeg"){
  if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new Error("The image contents do not match its file type.");
  let at=2;
  while(at+4<=bytes.length){
   if(bytes[at++]!==255)break;
   while(bytes[at]===255)at++;
   const marker=bytes[at++];
   if(marker===undefined||marker===0xda||marker===0xd9)break;
   if(marker===1||marker>=0xd0&&marker<=0xd8)continue;
   if(at+2>bytes.length)break;
   const size=view.getUint16(at);if(size<2||at+size>bytes.length)break;
   if([0xc0,0xc1,0xc2].includes(marker)&&size>=8){height=view.getUint16(at+3);width=view.getUint16(at+5);break;}
   at+=size;
  }
 }else throw new Error("Choose a PNG or JPEG screenshot.");
 if(!width||!height)throw new Error("Image dimensions could not be read. Choose a standard PNG or JPEG.");
 if(width*height>12000000)throw new Error("Choose an image no larger than 12 megapixels.");
 return {width,height};
}
