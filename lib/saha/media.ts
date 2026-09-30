import { fail } from './core';

// Slice 2b: visit media (BR-DATA-08). Small photographs and voice notes attached to a draft visit,
// checked for type, content signature, size and a stated purpose; immutable once the visit is
// confirmed; removable only from drafts, leaving a tombstone.
export const MEDIA_TYPES={'image/jpeg':'photo','image/png':'photo','image/webp':'photo','audio/webm':'audio','audio/ogg':'audio','audio/mpeg':'audio','audio/mp4':'audio'} as const;
export type MediaMime=keyof typeof MEDIA_TYPES;
export const MEDIA_PURPOSES=['wound-or-skin','document-or-card','medicine-packaging','voice-note','other-clinical'] as const;
export const MAX_MEDIA_BYTES=256*1024,MIN_MEDIA_BYTES=512,MAX_MEDIA_PER_VISIT=10;
export type MediaRef={id:string;purpose:typeof MEDIA_PURPOSES[number];mime:MediaMime;size:number;sha256:string;at:string;by:string;removedAt?:string;removedBy?:string;removeReason?:string};
const starts=(b:Uint8Array,sig:number[],at=0)=>sig.every((x,i)=>b[at+i]===x);
// The declared type must match the file's own signature; a renamed file is refused.
export function sniff(bytes:Uint8Array,mime:string):boolean{
 switch(mime){
  case 'image/jpeg':return starts(bytes,[0xff,0xd8,0xff]);
  case 'image/png':return starts(bytes,[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  case 'image/webp':return starts(bytes,[0x52,0x49,0x46,0x46])&&starts(bytes,[0x57,0x45,0x42,0x50],8);
  case 'audio/webm':return starts(bytes,[0x1a,0x45,0xdf,0xa3]);
  case 'audio/ogg':return starts(bytes,[0x4f,0x67,0x67,0x53]);
  case 'audio/mpeg':return starts(bytes,[0x49,0x44,0x33])||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0);
  case 'audio/mp4':return starts(bytes,[0x66,0x74,0x79,0x70],4);
  default:return false;
 }
}
export function checkMedia(bytes:Uint8Array,mime:string,purpose:string){
 if(!(mime in MEDIA_TYPES))fail(415,'Attach a JPEG, PNG or WebP photo, or a WebM, Ogg, MP3 or MP4 audio note.');
 if(!(MEDIA_PURPOSES as readonly string[]).includes(purpose))fail(422,'Choose why this media is being attached.');
 if(purpose==='voice-note'&&MEDIA_TYPES[mime as MediaMime]!=='audio')fail(422,'A voice note must be audio.');
 if(bytes.byteLength<MIN_MEDIA_BYTES)fail(422,'This file is too small to be a usable photo or recording.');
 if(bytes.byteLength>MAX_MEDIA_BYTES)fail(413,'Media must be 256 KB or smaller in this release. Reduce the photo size or shorten the note.');
 if(!sniff(bytes,mime))fail(422,'The file content does not match its declared type.');
}
// Over-limit bodies are read and discarded up to 1 MB before refusing, because cancelling an
// unread request body mid-stream restarts the local Worker runtime (seen since R10).
const DRAIN_LIMIT=1024*1024,TOO_LARGE='Media must be 256 KB or smaller in this release. Reduce the photo size or shorten the note.';
export async function readBounded(request:Request,max:number){
 const reader=request.body?.getReader();if(!reader)fail(400,'A file body is required.');const chunks:Uint8Array[]=[];let size=0,over=false;
 const declared=request.headers.get('content-length');if(declared&&(!/^\d+$/.test(declared)||Number(declared)>max))over=true;
 try{while(true){const {value,done}=await reader!.read();if(done)break;size+=value.byteLength;if(size>max)over=true;if(over){if(size>DRAIN_LIMIT){await reader!.cancel();break;}continue;}chunks.push(value);}}finally{reader!.releaseLock();}
 if(over)fail(413,TOO_LARGE);
 const out=new Uint8Array(size);let at=0;for(const c of chunks){out.set(c,at);at+=c.byteLength;}return out;
}
export const toB64=(b:Uint8Array)=>{let s='';for(let i=0;i<b.length;i+=0x8000)s+=String.fromCharCode(...b.subarray(i,i+0x8000));return btoa(s);};
export const fromB64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
