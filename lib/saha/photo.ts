// Slice 3f: on-device photo reduction for the online workspace, matching the field notebook (slice 3e).
// A photo is decoded, scaled to at most 1280 px on its long edge and saved as JPEG, stepping down size and
// quality until it is under 248 KB. Re-encoding keeps only pixels, so embedded metadata such as the camera's
// location is not uploaded. The decoder and canvas are injectable for tests.
export const PHOTO_STEPS:[number,number][]=[[1280,0.8],[1280,0.65],[1024,0.65],[800,0.6],[640,0.55],[480,0.5]];
export const PHOTO_TARGET=256*1024-8192;
type Env={createImageBitmap:(b:Blob)=>Promise<{width:number;height:number;close?:()=>void}>;OffscreenCanvas:new(w:number,h:number)=>{getContext(kind:'2d'):any;convertToBlob(o:{type:string;quality:number}):Promise<Blob>}};
export async function reducePhoto(file:Blob,env:Env={createImageBitmap:(b)=>globalThis.createImageBitmap(b),OffscreenCanvas:(globalThis as any).OffscreenCanvas}):Promise<Blob>{
 let bitmap;try{bitmap=await env.createImageBitmap(file);}catch{throw Error('This photo could not be read. Try another photo.');}
 if(!env.OffscreenCanvas)throw Error('This browser cannot reduce photos. Use the field notebook or a smaller photo.');
 try{for(const [edge,quality] of PHOTO_STEPS){const scale=Math.min(1,edge/Math.max(bitmap.width,bitmap.height)),w=Math.max(1,Math.round(bitmap.width*scale)),h=Math.max(1,Math.round(bitmap.height*scale));
   const canvas=new env.OffscreenCanvas(w,h);canvas.getContext('2d').drawImage(bitmap,0,0,w,h);const blob=await canvas.convertToBlob({type:'image/jpeg',quality});if(blob.size<=PHOTO_TARGET)return blob;}}
 finally{bitmap.close?.();}
 throw Error('This photo could not be reduced below 256 KB. Take a closer, simpler photo.');
}
