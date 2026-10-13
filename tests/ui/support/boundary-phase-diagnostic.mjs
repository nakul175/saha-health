import {appendFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
export function observeBoundary(){
 const path=process.env.SAHA_BOUNDARY_DIAGNOSTIC??'tests/reports/boundary-phase-diagnostic.jsonl';
 mkdirSync(dirname(path),{recursive:true});const original=globalThis.fetch;let active='starting',count=0;
 const event=(phase,data={})=>{const value={at:new Date().toISOString(),pid:process.pid,phase,...data};appendFileSync(path,JSON.stringify(value)+'\n');console.log('BOUNDARY-PHASE',JSON.stringify(value));};
 const phase=name=>{active=name;event(name);};const timer=setInterval(()=>event('still-active',{active}),15000);timer.unref();
 globalThis.fetch=async(input,init)=>{const id=++count,url=typeof input==='string'?input:input.url??String(input),method=init?.method??'GET';event('fetch-start',{id,url,method,active});try{const r=await original(input,init);event('fetch-headers',{id,status:r.status,active});const text=r.text.bind(r);r.text=async(...args)=>{event('body-start',{id,active});try{const value=await text(...args);event('body-done',{id,bytes:value.length,active});return value;}catch(e){event('body-error',{id,message:String(e),active});throw e;}};return r;}catch(e){event('fetch-error',{id,message:String(e),active});throw e;}};
 return {phase,stop(){clearInterval(timer);globalThis.fetch=original;event('diagnostic-stopped',{active});}};
}
