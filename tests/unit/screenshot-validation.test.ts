import {expect,it} from "vitest";
import {screenshotDimensions} from "@/features/offer/screenshot-validation";
function png(width:number,height:number){const bytes=new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);bytes.set([73,72,68,82],12);const view=new DataView(bytes.buffer);view.setUint32(16,width);view.setUint32(20,height);return bytes;}
it("rejects oversized PNG declarations before decoding",()=>{expect(screenshotDimensions(png(1000,500),"image/png")).toEqual({width:1000,height:500});expect(()=>screenshotDimensions(png(100000,100000),"image/png")).toThrow("12 megapixels");});
it("checks bounded JPEG segments and rejects disguised or truncated images",()=>{
 const jpeg=new Uint8Array([255,216,255,192,0,8,8,1,244,3,232,0]);expect(screenshotDimensions(jpeg,"image/jpeg")).toEqual({width:1000,height:500});
 for(const bytes of [new Uint8Array(),new TextEncoder().encode("<svg>not PNG</svg>"),jpeg.slice(0,8)])expect(()=>screenshotDimensions(bytes,"image/jpeg")).toThrow();
 expect(()=>screenshotDimensions(png(10,10),"image/svg+xml")).toThrow();
});
