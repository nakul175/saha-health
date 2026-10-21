import type {D1Database,D1PreparedStatement} from '@cloudflare/workers-types';
import {fail} from './core';
import {parseObjectRef} from './media-storage';
import {assertRetentionPurgeAuthority,type RetentionTombstone} from './retention';
import type {OrgState} from './types';

type MediaRow={org_id:string;id:string;person_id:string;visit_id:string;purpose:string;deleted_at:string|null;storage_ref:string|null};
type CustodyRow={org_id:string;id:string;person_id:string;visit_id:string;object_key:string;object_version:string|null;etag:string|null;state:string;created_at:string};
export type DisposalPlan={pendingObjects:number;statements:(token:string)=>D1PreparedStatement[]};

const key=(t:RetentionTombstone)=>`${t.recordClass}\u0000${t.recordId}`;
export async function prepareRetentionDisposal(d:D1Database,before:OrgState,after:OrgState):Promise<DisposalPlan|null>{
 const prior=new Set((before.retention?.tombstones??[]).map(key)),added=(after.retention?.tombstones??[]).filter(t=>!prior.has(key(t)));if(!added.length)return null;
 const media=new Map<string,{row:MediaRow;custody:CustodyRow|null;ref:ReturnType<typeof parseObjectRef>}>();
 for(const t of added){
  if(t.recordClass!=='raw-audio'&&t.recordClass!=='transcript')continue;
  const row=await d.prepare('SELECT org_id,id,person_id,visit_id,purpose,deleted_at,storage_ref FROM media WHERE org_id=? AND id=?').bind(before.organisation.id,t.recordId).first<MediaRow>();
  if(!row||row.person_id!==t.personId||row.deleted_at)fail(409,'Media disposal lineage changed before it could be saved.');
  if((t.recordClass==='raw-audio')!==(row.purpose==='voice-note'))fail(409,'Media disposal class changed before it could be saved.');
  const ref=parseObjectRef(row.storage_ref);let custody:CustodyRow|null=null;
  if(ref){custody=await d.prepare('SELECT org_id,id,person_id,visit_id,object_key,object_version,etag,state,created_at FROM media_custody WHERE org_id=? AND id=?').bind(before.organisation.id,t.recordId).first<CustodyRow>();if(!custody||custody.state!=='linked'||custody.person_id!==row.person_id||custody.visit_id!==row.visit_id||custody.object_key!==ref.key||custody.object_version!==ref.version||custody.etag!==ref.etag)fail(503,'Private media custody lineage is unavailable. No disposal was saved.');}
  media.set(t.recordId,{row,custody,ref});
 }
 const org=before.organisation.id;
 return {pendingObjects:[...media.values()].filter(x=>x.ref).length,statements:(token:string)=>{
  const guard='EXISTS (SELECT 1 FROM organisations WHERE id=? AND last_command=?)',out:D1PreparedStatement[]=[];
  for(const t of added){
   if(t.recordClass==='programme-receipt')out.push(d.prepare(`DELETE FROM submissions WHERE org_id=? AND id=? AND person_id=? AND ${guard}`).bind(org,t.recordId,t.personId,org,token));
   else if(t.recordClass==='rights-request')out.push(d.prepare(`DELETE FROM rights_requests WHERE org_id=? AND id=? AND person_id=? AND ${guard}`).bind(org,t.recordId,t.personId,org,token));
   else if(t.recordClass==='outreach-message')out.push(d.prepare(`UPDATE outreach SET data=json_set(data,'$.messages',COALESCE((SELECT json_group_array(json(value)) FROM json_each(data,'$.messages') WHERE json_extract(value,'$.id')<>?),'[]')) WHERE org_id=? AND NOT EXISTS (SELECT 1 FROM json_each(data,'$.messages') WHERE json_extract(value,'$.id')=? AND json_extract(value,'$.personId')<>?) AND ${guard}`).bind(t.recordId,org,t.recordId,t.personId,org,token));
   else if(t.recordClass==='raw-audio'||t.recordClass==='transcript'){
    const item=media.get(t.recordId)!;
    if(item.ref)out.push(d.prepare(`INSERT INTO retention_disposal_jobs (org_id,id,tombstone_id,record_class,record_id,person_id,object_key,object_version,etag,state,attempts,created_at) SELECT ?,?,?,?,?,?,?,?,?, 'pending',0,? WHERE ${guard}`).bind(org,t.id,t.id,t.recordClass,t.recordId,t.personId,item.ref.key,item.ref.version,item.ref.etag,t.disposedAt,org,token));
    out.push(d.prepare(`UPDATE media SET size=0,data='',storage_ref=NULL,deleted_at=? WHERE org_id=? AND id=? AND person_id=? AND deleted_at IS NULL AND ${guard}`).bind(t.disposedAt,org,t.recordId,t.personId,org,token));
    if(item.custody)out.push(d.prepare(`UPDATE media_custody SET state='removed' WHERE org_id=? AND id=? AND state='linked' AND object_key=? AND object_version=? AND etag=? AND ${guard}`).bind(org,t.recordId,item.ref!.key,item.ref!.version,item.ref!.etag,org,token));
   }
  }
  return out;
 }};
}

export type DisposalJob={org_id:string;id:string;tombstone_id:string;record_class:'raw-audio'|'transcript';record_id:string;person_id:string;object_key:string;object_version:string;etag:string;state:'pending'|'reserved'|'completed'|'blocked';attempts:number;last_attempt_at:string|null;last_error:string|null;reservation_token:string|null;reserved_at:string|null;reserved_by:string|null;request_key:string|null;request_hash:string|null;outcome:string|null;created_at:string;completed_at:string|null};
export async function retentionDisposalJob(d:D1Database,org:string,id:string){return d.prepare('SELECT * FROM retention_disposal_jobs WHERE org_id=? AND id=?').bind(org,id).first<DisposalJob>();}
export function tombstoneForJob(s:OrgState,j:DisposalJob){const t=s.retention?.tombstones?.find(x=>x.id===j.tombstone_id&&x.recordClass===j.record_class&&x.recordId===j.record_id&&x.personId===j.person_id);if(!t)fail(409,'The disposal authority is unavailable. Nothing was deleted.');assertRetentionPurgeAuthority(s,t);return t;}
const exact=(head:R2Object|null,j:Pick<DisposalJob,'object_version'|'etag'>)=>!head||(head.version===j.object_version&&head.etag===j.etag);
export async function reserveRetentionDisposal(d:D1Database,j:DisposalJob,actorId:string,requestKey:string,requestHash:string,at:string,token:string,eventId:string){
 if(j.state!=='pending')return j;
 const results=await d.batch([
  d.prepare("UPDATE retention_disposal_jobs SET state='reserved',reservation_token=?,reserved_at=?,reserved_by=?,request_key=?,request_hash=?,attempts=attempts+1,last_attempt_at=?,last_error=NULL,outcome='reserved' WHERE org_id=? AND id=? AND state='pending' AND object_key=? AND object_version=? AND etag=?").bind(token,at,actorId,requestKey,requestHash,at,j.org_id,j.id,j.object_key,j.object_version,j.etag),
  d.prepare("INSERT INTO retention_disposal_events (org_id,id,job_id,reservation_token,phase,outcome,actor_id,at,object_key,object_version,etag) SELECT ?,?,?,?,'reserved','authority-and-object-binding-reserved',?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM retention_disposal_jobs WHERE org_id=? AND id=? AND state='reserved' AND reservation_token=?)").bind(j.org_id,eventId,j.id,token,actorId,at,j.object_key,j.object_version,j.etag,j.org_id,j.id,token)
 ]);
 if(Number(results[0]?.meta?.changes)!==1||Number(results[1]?.meta?.changes)!==1)fail(409,'The disposal job changed before its authority could be reserved. Nothing was deleted.');
 const reserved=await retentionDisposalJob(d,j.org_id,j.id);if(!reserved||reserved.state!=='reserved'||reserved.reservation_token!==token)fail(503,'The disposal reservation could not be verified. Nothing was deleted.');return reserved;
}
export async function recordRetentionDisposalOutcome(d:D1Database,j:DisposalJob,state:'reserved'|'completed'|'blocked',outcome:string,error:string|null,actorId:string,at:string,eventId:string){
 if(!j.reservation_token)fail(409,'A durable disposal reservation is required before recording an outcome.');
 const completed=state==='completed'?at:null,results=await d.batch([
  d.prepare("UPDATE retention_disposal_jobs SET state=?,outcome=?,last_error=?,last_attempt_at=?,completed_at=?,attempts=attempts+CASE WHEN ?='reserved' THEN 1 ELSE 0 END WHERE org_id=? AND id=? AND state='reserved' AND reservation_token=?").bind(state,outcome,error,at,completed,state,j.org_id,j.id,j.reservation_token),
  d.prepare("INSERT INTO retention_disposal_events (org_id,id,job_id,reservation_token,phase,outcome,actor_id,at,object_key,object_version,etag) SELECT ?,?,?,?,'outcome',?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM retention_disposal_jobs WHERE org_id=? AND id=? AND reservation_token=? AND state=? AND outcome=?)").bind(j.org_id,eventId,j.id,j.reservation_token,outcome,actorId,at,j.object_key,j.object_version,j.etag,j.org_id,j.id,j.reservation_token,state,outcome)
 ]);
 if(Number(results[0]?.meta?.changes)!==1||Number(results[1]?.meta?.changes)!==1)fail(503,'The disposal outcome could not be recorded durably. Reconciliation stopped.');
}
export type ConditionalObjectDeletionCapability={
 kind:'conditional-version-specific-delete-v1'|'exact-immutable-version-delete-v1';
 deleteExact:(request:{key:string;version:string;etag:string})=>Promise<'deleted'|'absent'|'mismatch'|'unconfirmed'>;
};
export type PurgeHooks={allowDelete?:boolean;beforeFinalHead?:()=>Promise<void>|void;afterDelete?:()=>Promise<void>|void;conditionalDelete?:ConditionalObjectDeletionCapability};
export async function purgeReservedPrivateObject(bucket:R2Bucket|null,j:DisposalJob,hooks:PurgeHooks={}):Promise<{state:'reserved'|'completed'|'blocked';outcome:string;error:string|null}>{
 if(j.state!=='reserved'||!j.reservation_token)fail(409,'A durable disposal reservation is required. Nothing was deleted.');
 if(!bucket)return {state:'reserved',outcome:'storage-unavailable',error:'private-storage-unavailable'};
 const first=await bucket.head(j.object_key);if(!first)return {state:'completed',outcome:'confirmed-absent',error:null};
 if(!exact(first,j))return {state:'blocked',outcome:'object-replaced',error:'reserved-object-version-mismatch'};
 if(hooks.allowDelete===false)return {state:'blocked',outcome:'authority-changed-before-delete',error:'reserved-authority-no-longer-current'};
 await hooks.beforeFinalHead?.();const final=await bucket.head(j.object_key);if(!final)return {state:'completed',outcome:'confirmed-absent-before-delete',error:null};
 if(!exact(final,j))return {state:'blocked',outcome:'object-replaced-before-delete',error:'reserved-object-version-mismatch'};
 // A HEAD followed by an unconditional key delete is not an atomic version binding. Refuse the
 // irreversible boundary unless a trusted storage adapter exposes an exact conditional delete.
 // The generic R2 binding currently has no such primitive, so production remains fail closed.
 if(!hooks.conditionalDelete||!['conditional-version-specific-delete-v1','exact-immutable-version-delete-v1'].includes(hooks.conditionalDelete.kind))return {state:'blocked',outcome:'provider-conditional-delete-unavailable',error:'conditional-or-exact-version-delete-required'};
 const deletion=await hooks.conditionalDelete.deleteExact({key:j.object_key,version:j.object_version,etag:j.etag});
 if(deletion==='mismatch')return {state:'blocked',outcome:'object-replaced-at-delete',error:'reserved-object-version-mismatch'};
 if(deletion==='unconfirmed')return {state:'reserved',outcome:'delete-unconfirmed',error:'object-disposal-unconfirmed'};
 await hooks.afterDelete?.();const remaining=await bucket.head(j.object_key);
 if(!remaining)return {state:'completed',outcome:'delete-confirmed-absent',error:null};
 if(!exact(remaining,j))return {state:'blocked',outcome:'object-replaced-after-delete',error:'post-delete-object-version-mismatch'};
 return {state:'reserved',outcome:'delete-unconfirmed',error:'object-disposal-unconfirmed'};
}
