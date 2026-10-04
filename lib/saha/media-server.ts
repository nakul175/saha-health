import { boundedJsonBody } from './request-body';
import { identity, loadFor, db, json } from './server';
import { digest, fail, person, uuid, visit } from './core';
import { persist, scope, type Row } from './store';
import { ensureOperating } from './operations';
import { ensureNotMerged } from './merge';
import { ensureExceptionalScope } from './exceptional';
import { accessRoute, recordAccess } from './access-audit';
import { checkMedia, fromB64, MAX_MEDIA_BYTES, MAX_MEDIA_PER_VISIT, readBounded, toB64, type MediaMime, type MediaRef } from './media';
// Slice 2b: upload to a draft visit, playback for anyone with patient access, removal from drafts.
function sameOrigin(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)fail(403,'Cross-origin changes are not allowed.');if(request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Cross-site changes are not allowed.');}
function idempotency(request:Request){const key=request.headers.get('idempotency-key');if(!key||!/^[a-zA-Z0-9_-]{8,100}$/.test(key))fail(400,'A valid idempotency key is required.');return key!;}
async function replay(userId:string,key:string,hash:string){const old=await db().prepare('SELECT hash,result FROM command_receipts WHERE actor_id=? AND key=?').bind(userId,key).first<{hash:string;result:string}>();if(!old)return null;if(old.hash!==hash)fail(409,'This operation key was already used for different input.');return {...JSON.parse(old.result),replayed:true};}
const visitPerson=async(orgId:string,visitId:string)=>{const r=await db().prepare('SELECT person_id FROM visits WHERE org_id=? AND id=?').bind(orgId,visitId).first<{person_id:string}>();return r?[r.person_id]:null;};
export async function uploadMedia(request:Request){
 sameOrigin(request);const u=await identity(),key=idempotency(request),url=new URL(request.url),visitId=url.searchParams.get('visitId')??'',purpose=url.searchParams.get('purpose')??'';
 const mime=(request.headers.get('content-type')??'').split(';')[0].trim().toLowerCase();
 if(!visitId||visitId.length>200)fail(422,'Choose a visit.');
 const bytes=await readBounded(request,MAX_MEDIA_BYTES);checkMedia(bytes,mime,purpose);
 const sha=toB64(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes as unknown as BufferSource))),hash=await digest({type:'attachMedia',visitId,purpose,mime,sha});
 const prior=await replay(u.userId,key,hash);if(prior)return json(prior);
 const s=await loadFor(u,request.headers.get('x-saha-organisation'),orgId=>visitPerson(orgId,visitId)),before=structuredClone(s),m=scope(s,u.userId),c={type:'attachMedia',visitId};
 ensureOperating(s,c);ensureNotMerged(s,c);ensureExceptionalScope(s,m,c);
 if(!['asha','clinician'].includes(m.role))fail(403,'A care role is required to attach media.');
 const v=visit(s.workspace,visitId);if(v.state!=='draft'||v.voidedAt||v.supersededBy)fail(409,'Attach media while the visit is a draft. Confirmed visits are immutable.');
 const current=(v.media??[]).filter(x=>!x.removedAt);if(current.length>=MAX_MEDIA_PER_VISIT)fail(422,`At most ${MAX_MEDIA_PER_VISIT} media items per visit.`);if(current.some(x=>x.sha256===sha))fail(409,'This file is already attached to the visit.');
 const now=new Date().toISOString(),ref:MediaRef={id:uuid(),purpose:purpose as MediaRef['purpose'],mime:mime as MediaMime,size:bytes.byteLength,sha256:sha,at:now,by:u.userId};
 (v.media??=[]).push(ref);s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'attachMedia',subject:v.id,personId:v.personId,detail:`${ref.mime} (${Math.round(ref.size/1024)} KB) attached to the draft visit for ${ref.purpose}. Type, signature and size checked.`});
 const row:Row={table:'media',values:{org_id:s.organisation.id,id:ref.id,person_id:v.personId,visit_id:v.id,mime:ref.mime,size:ref.size,sha256:sha,purpose:ref.purpose,created_at:now,deleted_at:null,data:toB64(bytes)},keys:['org_id','id']};
 const result={mediaId:ref.id,size:ref.size};await persist(db(),before,s,u,c,key,hash,result,[row]);return json(result);
}
export async function mediaFile(request:Request,id:string){
 const u=await identity(),url=new URL(request.url),org=url.searchParams.get('organisationId')??request.headers.get('x-saha-organisation');
 if(!id||id.length>200)fail(404,'Media not found.');
 let found:{person_id:string;visit_id:string;mime:string;data:string;deleted_at:string|null}|null=null;
 const s=await loadFor(u,org,async orgId=>{found=await db().prepare('SELECT person_id,visit_id,mime,data,deleted_at FROM media WHERE org_id=? AND id=?').bind(orgId,id).first();return found?[(found as any).person_id]:null;});
 if(!found)fail(404,'Media not found.');const f=found as unknown as {person_id:string;visit_id:string;mime:string;data:string;deleted_at:string|null};
 const m=scope(s,u.userId),p=person(s.workspace,f.person_id);
 // Slice 14f: media whose content was disposed under the retention schedule says so (the disposal register holds it).
 if(f.deleted_at){const disposed=await db().prepare("SELECT 1 AS ok FROM disposals WHERE org_id=? AND table_name='media' AND record_id=?").bind(s.organisation.id,id).first();fail(410,disposed?'This media was disposed under the retention schedule.':'This media was removed from a draft visit.');}
 // Slice 6t: opening visit media is a material read, recorded before the bytes are returned.
 await recordAccess(db(),s,u,m,{action:'viewMedia',subject:id,personId:f.person_id,detail:`Visit media opened: ${id} (${f.mime}) on visit ${f.visit_id}.${accessRoute(m,p)}`});
 return new Response(fromB64(f.data) as unknown as BodyInit,{headers:{'Content-Type':f.mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline','Content-Security-Policy':"default-src 'none'; sandbox"}});
}
export async function removeMedia(request:Request,id:string){
 sameOrigin(request);const u=await identity(),key=idempotency(request);
 // Slice 6l: the reason travels in a JSON body so it stays out of request URLs and platform logs; the query form is still accepted.
 const body=request.headers.get('content-type')?.startsWith('application/json')?await boundedJsonBody(request,4000):null,reason=(body&&typeof body.reason==='string'?body.reason:new URL(request.url).searchParams.get('reason')??'').trim();
 if(reason.length<5||reason.length>1000)fail(422,'Give a reason of at least 5 characters.');
 const hash=await digest({type:'removeMedia',id,reason});const prior=await replay(u.userId,key,hash);if(prior)return json(prior);
 let row:{person_id:string;visit_id:string}|null=null;
 const s=await loadFor(u,request.headers.get('x-saha-organisation'),async orgId=>{row=await db().prepare('SELECT person_id,visit_id FROM media WHERE org_id=? AND id=?').bind(orgId,id).first();return row?[(row as any).person_id]:null;});
 if(!row)fail(404,'Media not found.');const r=row as unknown as {person_id:string;visit_id:string};
 const before=structuredClone(s),m=scope(s,u.userId),c={type:'removeMedia',visitId:r.visit_id};ensureOperating(s,c);ensureExceptionalScope(s,m,c);
 if(!['asha','clinician'].includes(m.role))fail(403,'A care role is required to remove media.');
 const v=visit(s.workspace,r.visit_id);if(v.state!=='draft'||v.voidedAt||v.supersededBy)fail(409,'Media on a confirmed visit cannot be removed; record a correction instead.');
 const ref=(v.media??[]).find(x=>x.id===id);if(!ref||ref.removedAt)fail(409,'This media is already removed.');
 const now=new Date().toISOString();Object.assign(ref!,{removedAt:now,removedBy:u.userId,removeReason:reason});
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'removeMedia',subject:v.id,personId:v.personId,detail:`Media removed from the draft visit; content deleted and a tombstone kept. ${reason}`});
 const tomb:Row={table:'media',values:{org_id:s.organisation.id,id,person_id:v.personId,visit_id:v.id,mime:ref!.mime,size:0,sha256:ref!.sha256,purpose:ref!.purpose,created_at:ref!.at,deleted_at:now,data:''},keys:['org_id','id']};
 const result={removed:id};await persist(db(),before,s,u,c,key,hash,result,[tomb]);return json(result);
}
