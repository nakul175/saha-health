import {z} from 'zod';
import type {D1Database} from '@cloudflare/workers-types';
import {guarded,type Actor,type Row} from './store';
import {digest,fail,uuid} from './core';
import {linkRows,chainMoved,chainBackoff,compensateUncommittedAuditDetails,compensatedAuditWriteError} from './audit-chain';

const ref=z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/);
const id=z.string().uuid(),hash=z.string().regex(/^[0-9a-f]{64}$/),common={id,surface:z.enum(['app','field']),claimedAt:z.string().datetime({offset:true}).max(40)};
const display={...common,count:z.literal(1)};
export const offlineOpenEvent=z.union([
 z.object({...display,kind:z.literal('prepared'),leaseId:ref,packageHash:hash,presentation:z.enum(['notebook-unlock','record-entry'])}).strict(),
 z.object({...display,kind:z.literal('accepted-registration'),registrationId:id,receiptKey:ref.optional(),bodyHash:hash.optional(),presentation:z.enum(['notebook-unlock','registration-entry'])}).strict().refine(e=>(e.receiptKey===undefined)===(e.bodyHash===undefined)),
 z.object({...display,kind:z.literal('match-candidates'),copyId:hash,presentation:z.enum(['notebook-unlock','match-candidates'])}).strict(),
 z.object({...display,kind:z.literal('local-registration'),localId:id,contentHash:hash,status:z.enum(['unsent','unknown']),presentation:z.enum(['notebook-unlock','registration-entry','registration-form'])}).strict(),
 z.object({...common,kind:z.literal('accepted-mapping'),openId:id,registrationId:id,receiptKey:ref,bodyHash:hash,count:z.literal(0),presentation:z.literal('accepted-mapping')}).strict()
]);
export const offlineOpenBody=z.object({expectedActorId:z.string().min(1).max(200),events:z.array(offlineOpenEvent).min(1).max(20).refine(events=>new Set(events.map(e=>e.id)).size===events.length)}).strict();
type Grant={org_id:string;actor_id:string;lease_id:string;package_hash:string;person_id:string;visit_id:string;member_version:number;consent_version:number;identity_hash:string;issued_at:string;original_role:string|null;visit_version:number;expires_at:string};
const refuse=()=>fail(403,'Original-worker offline report is unavailable.');
type Subject={personId:string;visitId:string|null;provenance:Record<string,unknown>};
async function registrationProof(d:D1Database,u:Actor,org:string,e:{registrationId:string;receiptKey?:string;bodyHash?:string}):Promise<Subject>{
 const grant=await d.prepare('SELECT * FROM device_registration_grants WHERE org_id=? AND actor_id=? AND registration_id=?').bind(org,u.userId,e.registrationId).first<any>();if(!grant)refuse();
 const receiptKey=e.receiptKey??grant.receipt_key,bodyHash=e.bodyHash??grant.body_hash;
 const receipt=await d.prepare('SELECT * FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId,receiptKey).first<any>();if(!receipt||receipt.org_id!==org||receipt.person_id!==grant.person_id||receipt.command_type!=null&&receipt.command_type!=='registerFieldPerson')refuse();
 const mapping=await d.prepare('SELECT * FROM device_registration_receipts WHERE org_id=? AND actor_id=? AND registration_id=? AND receipt_key=? AND body_hash=?').bind(org,u.userId,e.registrationId,receiptKey,receipt.hash).first<any>();
 const wire=bodyHash===receipt.hash?null:await d.prepare('SELECT * FROM device_registration_wire_receipts WHERE org_id=? AND actor_id=? AND registration_id=? AND receipt_key=? AND wire_hash=?').bind(org,u.userId,e.registrationId,receiptKey,bodyHash).first<any>();
 if(bodyHash!==receipt.hash&&(!wire||wire.body_hash!==receipt.hash||wire.person_id!==grant.person_id)||mapping&&mapping.person_id!==grant.person_id||!mapping&&(receiptKey!==grant.receipt_key||receipt.hash!==grant.body_hash))refuse();
 return {personId:grant.person_id,visitId:null,provenance:{format:'saha-accepted-registration-v1',originalRole:grant.original_role,memberVersion:grant.member_version,personVersion:grant.person_version,consentVersion:grant.consent_version,identityHash:grant.identity_hash,issuedAt:grant.issued_at,legacy:!!grant.legacy,receiptKey,bodyHash:receipt.hash,reportedBodyHash:bodyHash,wireMapped:bodyHash!==receipt.hash,source:'exact original accepted registration receipt and protected wire mapping; no historical permission claim'}} satisfies Subject;
}
async function resolveReference(d:D1Database,u:Actor,org:string,e:z.infer<typeof offlineOpenEvent>):Promise<{subjects:Subject[];provenance:Record<string,unknown>}>{
 if(e.kind==='prepared'){
  const g=await d.prepare('SELECT * FROM device_work_grants WHERE org_id=? AND actor_id=? AND lease_id=? AND package_hash=?').bind(org,u.userId,e.leaseId,e.packageHash).first<Grant>();if(!g)refuse();
  const provenance={format:'saha-original-device-grant-v1',originalRole:g!.original_role,memberVersion:g!.member_version,consentVersion:g!.consent_version,visitVersion:g!.visit_version,issuedAt:g!.issued_at,expiresAt:g!.expires_at,identityHash:g!.identity_hash,source:'immutable original grant; permission at client clock time is not proven'};
  return {subjects:[{personId:g!.person_id,visitId:g!.visit_id,provenance}],provenance};
 }
 if(e.kind==='accepted-registration'||e.kind==='accepted-mapping'){
  const subject=await registrationProof(d,u,org,e);
  if(e.kind==='accepted-mapping'){
   const previous=await d.prepare('SELECT kind,reference FROM offline_open_reports WHERE org_id=? AND actor_id=? AND id=?').bind(org,u.userId,e.openId).first<{kind:string;reference:string}>();if(!previous||previous.kind!=='local-registration'||JSON.parse(previous.reference).localId!==e.registrationId)refuse();
   subject.provenance={...subject.provenance,originalOpenId:e.openId,source:'append-only correlation by original opaque registration ID and exact accepted receipt; not proof of patient permission at the earlier local presentation'};
  }
  return {subjects:[subject],provenance:subject.provenance};
 }
 if(e.kind==='match-candidates'){
  const copy=await d.prepare('SELECT * FROM device_match_copies WHERE org_id=? AND actor_id=? AND id=?').bind(org,u.userId,e.copyId).first<any>();if(!copy)refuse();
  const versions=JSON.parse(copy.candidate_versions),provenance={format:'saha-original-match-copy-v1',memberVersion:copy.member_version,originalRole:copy.original_role,queryHash:copy.query_hash,issuedAt:copy.issued_at,candidateCount:versions.length,source:'server registered returned candidates and original member role; historical permission at client clock time is not proven'};
  return {subjects:versions.map((p:any)=>({personId:p.id,visitId:null,provenance:{...provenance,personVersion:p.version}})),provenance};
 }
 const relationship=await d.prepare('SELECT 1 FROM memberships WHERE org_id=? AND user_id=?').bind(org,u.userId).first();if(!relationship)refuse();
 return {subjects:[],provenance:{format:'saha-client-local-registration-v1',originalRole:null,memberVersion:null,source:'stored own-organisation relationship only; content digest, occurrence and historical clinical permission are client claims; no patient inferred'}};
}

// This is an historical metadata upload. The original worker may be suspended
// now: accepting their report neither reads nor renews clinical authority.
export async function reportOfflineOpens(d:D1Database,u:Actor,org:string,input:unknown){
 const parsed=offlineOpenBody.safeParse(input);if(!parsed.success)fail(422,'Use bounded fixed offline presentation metadata.');if(parsed.data.expectedActorId!==u.userId)refuse();if(!org||org.length>200)refuse();
 const prepared=[];for(const e of parsed.data.events){
  const resolved=await resolveReference(d,u,org,e);
  prepared.push({event:e,...resolved,hash:await digest({format:'saha-offline-open-v1',organisationId:org,...e})});
 }
 const receivedAt=new Date().toISOString();
 for(let attempt=1;attempt<=5;attempt++){
  // Check the entire batch, including prior receipt bodies, before any write.
  const fresh=[];for(const item of prepared){const old=await d.prepare('SELECT org_id,input_hash FROM offline_open_reports WHERE actor_id=? AND id=?').bind(u.userId,item.event.id).first<{org_id:string;input_hash:string}>();if(old){if(old.org_id!==org||old.input_hash!==item.hash)fail(409,'Offline report key already identifies different metadata.');}else fresh.push(item);}
  if(!fresh.length)return {userId:u.userId,accepted:prepared.map(x=>x.event.id),replayed:true};
  const rows:Row[]=[];
  for(const {event:e,subjects,provenance,hash} of fresh){
   const {id:reportId,surface,presentation,count,claimedAt,...reference}=e;
   rows.push({table:'offline_open_reports',keys:['actor_id','id'],append:true,values:{org_id:org,actor_id:u.userId,id:reportId,input_hash:hash,kind:e.kind,reference:JSON.stringify(reference),surface,presentation,count,claimed_at:claimedAt,received_at:receivedAt,provenance:JSON.stringify(provenance)}});
   for(const subject of subjects)rows.push({table:'offline_open_subjects',keys:['actor_id','report_id','person_id'],append:true,values:{org_id:org,actor_id:u.userId,report_id:reportId,person_id:subject.personId,visit_id:subject.visitId,provenance:JSON.stringify(subject.provenance)}});
   for(const subject of subjects.length?subjects:[null])rows.push({table:'audit_events',keys:['org_id','id'],append:true,values:{org_id:org,id:uuid(),person_id:subject?.personId??null,actor_id:u.userId,actor_name:'Original device worker',role:'device-reported',action:e.kind==='accepted-mapping'?'clientReportedOfflineOpenMapping':'clientReportedOfflineOpen',subject:subject?.personId??org,detail:JSON.stringify({format:'saha-offline-open-v1',reportId,surface,presentation,count,claimedAt,receivedAt,reference,provenance:subject?.provenance??provenance,outcome:e.kind==='accepted-mapping'?'exact accepted-receipt correlation appended; not a new presentation':'client reports cached presentation; not server-observed clinical access or current permission'}),at:receivedAt}});
  }
  const token=uuid(),chain=await linkRows(d,org,rows,receivedAt);
  // An audit-only token changes no clinical or organisation revision. Unique
  // report IDs and chain sequence enforce all-or-nothing concurrent replay.
  try{const saved=await d.batch([d.prepare('UPDATE organisations SET last_command=? WHERE id=?').bind(token,org),...guarded(d,org,token,chain.genesis?[chain.genesis,...rows]:rows)]);if(saved[0].meta.changes!==1)refuse();return {userId:u.userId,accepted:prepared.map(x=>x.event.id),replayed:false};}
  catch(error){if(attempt<5&&(await chainMoved(d,org,chain.base)||await d.prepare('SELECT 1 FROM offline_open_reports WHERE actor_id=? AND id=?').bind(u.userId,fresh[0].event.id).first())){await compensateUncommittedAuditDetails(rows);await chainBackoff(attempt);continue;}throw await compensatedAuditWriteError(error,rows);}
 }
 return fail(409,'Keep the original offline report keys for retry.');
}
