import { identity, loadFor, json, db, rawRuntime } from './server';
import { scope } from './store';
import { retentionReview, yearsAgo } from './retention';
import {boundedJsonBody} from './request-body';
import {digest,fail,uuid} from './core';
import {mediaBackend} from './media-storage';
import {purgeReservedPrivateObject,recordRetentionDisposalOutcome,reserveRetentionDisposal,retentionDisposalJob,tombstoneForJob} from './retention-disposal';
import {productionObjectDeleteCapability} from './s3-versioned-delete-runtime';
// Slice 6c: retention schedule, holds and eligibility counts for organisation owners.
export async function retentionRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId),now=new Date().toISOString();
 const rule=s.retention?.policies.at(-1)?.rules.find(r=>r.recordClass==='audit-event');
 const total=await db().prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=?').bind(s.organisation.id).first<{n:number}>();
 const past=rule?await db().prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND at<?').bind(s.organisation.id,yearsAgo(now,rule.years)).first<{n:number}>():null;
 const pending=await db().prepare("SELECT id,record_class,record_id,state,outcome,created_at,attempts,last_attempt_at,last_error FROM retention_disposal_jobs WHERE org_id=? AND state IN ('pending','reserved','blocked') ORDER BY created_at,id LIMIT 101").bind(s.organisation.id).all<Record<string,unknown>>();if(pending.results.length>100)fail(503,'Pending disposal inventory exceeds the review limit. Ask for controlled reconciliation.');
 return json({...retentionReview(s,m,{total:total?.n??0,pastSchedule:past?.n??0},now),pendingDisposals:pending.results.map(x=>({id:x.id,recordClass:x.record_class,recordId:x.record_id,state:x.state,outcome:x.outcome,createdAt:x.created_at,attempts:x.attempts,lastAttemptAt:x.last_attempt_at,lastError:x.last_error}))});
}

export async function retentionWrite(request:Request){
 const origin=request.headers.get('origin');if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Cross-origin changes are refused.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this operation.');
 const key=request.headers.get('idempotency-key');if(!key||!/^[a-zA-Z0-9_-]{8,100}$/.test(key))fail(400,'A valid idempotency key is required.');
 const body=await boundedJsonBody(request,1000) as unknown;if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='jobId,type'||(body as any).type!=='retentionObjectPurgeReconcile'||typeof (body as any).jobId!=='string'||!/^[0-9a-f-]{36}$/.test((body as any).jobId))fail(422,'Choose one pending retention disposal.');
 const jobId=(body as any).jobId as string,u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);if(!m.isOwner)fail(403,'Only an organisation owner can reconcile retention disposal.');
 const hash=await digest(body),prior=await db().prepare('SELECT hash,result,org_id FROM command_receipts WHERE actor_id=? AND key=?').bind(u.userId,key).first<{hash:string;result:string;org_id:string}>();if(prior){if(prior.hash!==hash)fail(409,'This operation key was already used for different input.');if(prior.org_id!==s.organisation.id)fail(403,'Open the original organisation to recover this disposal receipt.');return json({...JSON.parse(prior.result),replayed:true});}
 let job=await retentionDisposalJob(db(),s.organisation.id,jobId);if(!job)fail(404,'Pending disposal not found.');if(job.request_key===key&&job.request_hash&&job.request_hash!==hash)fail(409,'This operation key was already used for different input.');if(job.state==='completed')return json({completed:true,jobId,outcome:job.outcome,replayed:true});if(job.state==='blocked')fail(409,'This disposal is blocked by changed authority or object identity. Review its immutable outcome evidence.');
 if(job.state==='pending'){tombstoneForJob(s,job);const now=new Date().toISOString();job=await reserveRetentionDisposal(db(),job,u.userId,key,hash,now,uuid(),uuid());}
 let authorityCurrent=true;try{const latest=await loadFor(u,s.organisation.id),latestMember=scope(latest,u.userId);if(!latestMember.isOwner)authorityCurrent=false;else tombstoneForJob(latest,job);}catch{authorityCurrent=false;}
 const providerRuntime=rawRuntime(),conditionalDelete=productionObjectDeleteCapability(providerRuntime);
 let outcome:{state:'reserved'|'completed'|'blocked';outcome:string;error:string|null};try{outcome=await purgeReservedPrivateObject(mediaBackend(providerRuntime).bucket,job,{allowDelete:authorityCurrent,conditionalDelete:conditionalDelete??undefined});}catch{outcome={state:'reserved',outcome:'provider-error',error:'object-disposal-provider-error'};}const now=new Date().toISOString();
 await recordRetentionDisposalOutcome(db(),job,outcome.state,outcome.outcome,outcome.error,u.userId,now,uuid());
 if(outcome.state==='completed')return json({completed:true,jobId,outcome:outcome.outcome});
 if(outcome.state==='blocked')fail(409,'The reserved disposal was blocked. No unreserved object was deleted; inspect its immutable outcome evidence.');
 fail(503,'Private media disposal was not confirmed. The durable reservation and outcome were retained for retry.');
}
