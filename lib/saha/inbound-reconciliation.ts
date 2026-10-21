import { z } from 'zod';
import type { Role } from './types';

class ReconciliationError extends Error{constructor(public status:number,message:string){super(message)}}
function fail(status:number,message:string):never{throw new ReconciliationError(status,message)}
const uuid=()=>crypto.randomUUID();
async function digest(value:unknown){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('')}

const id=z.string().trim().min(1).max(200), instant=z.string().datetime(), version=z.number().int().nonnegative();
const value=z.record(z.string().min(1).max(100),z.union([z.string().max(3000),z.number(),z.boolean(),z.null()])).refine(x=>Object.keys(x).length<=100,'Inbound records may contain at most 100 fields.');
export const inboundChangeSchema=z.object({source:id,sourceRecordId:id,sourceVersion:version,effectiveAt:instant,receivedAt:instant,recordId:id,value}).strict();
export const receiptWatchSchema=z.object({connectorId:id,operationId:id,key:id,payloadHash:z.string().regex(/^[a-f0-9]{64}$/),nextLookupAt:instant}).strict();
export type InboundChange=z.infer<typeof inboundChangeSchema>;
export type LocalRecord={id:string;version:number;value:Record<string,string|number|boolean|null>;updatedAt:string;pendingCorrection?:{version:number;value:Record<string,string|number|boolean|null>;by:string;at:string}};
export type InboundReview={id:string;recordId:string;state:'open'|'resolved';reason:'pending-local-correction'|'stale-source-version'|'same-version-different-content';source:{system:string;recordId:string;version:number;effectiveAt:string;receivedAt:string;value:InboundChange['value'];hash:string};local:{version:number;value:LocalRecord['value'];pendingCorrection?:LocalRecord['pendingCorrection']};createdAt:string;assignedRole:'integration-owner';resolution?:{choice:'keep-local'|'apply-inbound';reason:string;by:string;at:string}};
export type ReceiptWatch=z.infer<typeof receiptWatchSchema>&{attempts:number;state:'due'|'pending'|'accepted'|'rejected'|'not-found';lastCheckedAt?:string;receipt?:string;message:string};
export type InboundState={records:LocalRecord[];reviews:InboundReview[];sourceHeads:Record<string,number>;receiptWatches:ReceiptWatch[];audit:{id:string;at:string;actor:string;role:Role;action:string;subject:string;detail:string}[]};
export type Reviewer={userId:string;role:Role;active:boolean;integrationOwner:boolean;mayRead:(recordId:string)=>boolean;mayWrite:(recordId:string)=>boolean};
export type ReceiptResult={key:string;payloadHash:string;status:'accepted'|'rejected'|'pending'|'not_found';receipt?:string};

function permitted(a:Reviewer,recordId:string,write=false){if(!a.active||!a.integrationOwner||!['clinician','supervisor'].includes(a.role)||!a.mayRead(recordId)||(write&&!a.mayWrite(recordId)))fail(403,'Active integration-owner review authority is required for this record.');}
const sourceKey=(c:Pick<InboundChange,'source'|'sourceRecordId'>)=>`${c.source}\u0000${c.sourceRecordId}`;
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function audit(s:InboundState,a:Reviewer,at:string,action:string,subject:string,detail:string){s.audit.push({id:uuid(),at,actor:a.userId,role:a.role,action,subject,detail});}

/** Compare a source-versioned inbound change without ever silently replacing pending local work. */
export async function receiveInbound(s:InboundState,input:unknown,a:Reviewer){
 const c=inboundChangeSchema.parse(input);permitted(a,c.recordId,true);if(c.receivedAt<c.effectiveAt)fail(422,'Received time cannot precede the source effective time.');
 const record=s.records.find(x=>x.id===c.recordId);if(!record)fail(404,'Local record not found.');
 const key=sourceKey(c),head=s.sourceHeads[key]??-1,hash=await digest({source:c.source,sourceRecordId:c.sourceRecordId,sourceVersion:c.sourceVersion,effectiveAt:c.effectiveAt,value:c.value});
 const replay=s.reviews.find(x=>x.source.hash===hash);if(replay)return {outcome:'review' as const,reviewId:replay.id,replayed:true};
 if(c.sourceVersion===head&&same(record.value,c.value))return {outcome:'unchanged' as const,replayed:true};
 const reason=record.pendingCorrection?'pending-local-correction':c.sourceVersion<head?'stale-source-version':c.sourceVersion===head&&!same(record.value,c.value)?'same-version-different-content':null;
 if(reason){const review:InboundReview={id:uuid(),recordId:record.id,state:'open',reason,source:{system:c.source,recordId:c.sourceRecordId,version:c.sourceVersion,effectiveAt:c.effectiveAt,receivedAt:c.receivedAt,value:structuredClone(c.value),hash},local:{version:record.version,value:structuredClone(record.value),...(record.pendingCorrection?{pendingCorrection:structuredClone(record.pendingCorrection)}:{})},createdAt:c.receivedAt,assignedRole:'integration-owner'};s.reviews.push(review);s.sourceHeads[key]=Math.max(head,c.sourceVersion);audit(s,a,c.receivedAt,'inboundConflict',record.id,`Inbound ${c.source} version ${c.sourceVersion} held for review; local version ${record.version} and source payload retained (${reason}).`);return {outcome:'review' as const,reviewId:review.id,replayed:false};}
 record.value=structuredClone(c.value);record.version++;record.updatedAt=c.receivedAt;s.sourceHeads[key]=c.sourceVersion;audit(s,a,c.receivedAt,'inboundApplied',record.id,`Applied ${c.source} version ${c.sourceVersion}, effective ${c.effectiveAt}; source identity and time retained in audit.`);return {outcome:'applied' as const,recordVersion:record.version};
}

export function reviewView(s:InboundState,a:Reviewer){return s.reviews.filter(x=>x.state==='open'&&a.mayRead(x.recordId)).map(x=>{permitted(a,x.recordId);return structuredClone(x);});}

export function resolveInbound(s:InboundState,reviewId:string,choice:'keep-local'|'apply-inbound',reason:string,a:Reviewer,at:string){
 const r=s.reviews.find(x=>x.id===reviewId);if(!r)fail(404,'Inbound review not found.');permitted(a,r.recordId,true);if(r.state!=='open')fail(409,'Inbound review was already resolved.');if(reason.trim().length<10||reason.length>500)fail(422,'Give a resolution reason of 10 to 500 characters.');const record=s.records.find(x=>x.id===r.recordId);if(!record)fail(404,'Local record not found.');
 if(record.version!==r.local.version||!same(record.value,r.local.value)||!same(record.pendingCorrection,r.local.pendingCorrection))fail(409,'Local work changed after this review opened. Compare a fresh review; nothing was overwritten.');
 if(choice==='apply-inbound'){record.value=structuredClone(r.source.value);record.pendingCorrection=undefined;record.version++;record.updatedAt=at;}
 r.state='resolved';r.resolution={choice,reason:reason.trim(),by:a.userId,at};audit(s,a,at,'inboundResolved',r.recordId,`${choice==='keep-local'?'Kept local work':'Applied reviewed inbound version '+r.source.version}. Reason: ${reason.trim()}`);return {recordVersion:record.version,choice};
}

/** Scheduled lookup only. It never sends or retries the external operation. */
export async function reconcileDueReceipts(s:InboundState,now:string,lookup:(watch:Readonly<ReceiptWatch>)=>Promise<ReceiptResult>,limit=25){
 if(!Number.isInteger(limit)||limit<1||limit>100)fail(422,'Receipt reconciliation limit must be between 1 and 100.');const due=s.receiptWatches.filter(x=>['due','pending'].includes(x.state)&&x.nextLookupAt<=now).sort((a,b)=>a.nextLookupAt.localeCompare(b.nextLookupAt)||a.operationId.localeCompare(b.operationId)).slice(0,limit);const results=[];
 for(const w of due){let r:ReceiptResult;try{r=await lookup(structuredClone(w));}catch{w.lastCheckedAt=now;w.nextLookupAt=new Date(Date.parse(now)+15*60000).toISOString();w.message='Receipt lookup unavailable. Outcome remains unresolved; do not resend.';results.push({operationId:w.operationId,state:w.state});continue;}
  if(r.key!==w.key||r.payloadHash!==w.payloadHash)fail(502,'Receipt lookup returned a different operation.');if(r.status==='accepted'&&!r.receipt)fail(502,'Accepted receipt lookup requires a receipt identifier.');w.attempts++;w.lastCheckedAt=now;w.state=r.status==='not_found'?'not-found':r.status;w.receipt=r.receipt;w.message=r.status==='accepted'?'Destination confirmed receipt.':r.status==='rejected'?'Destination rejected the operation.':r.status==='not_found'?'Destination confirms no record for this key; a person must decide whether to prepare a retry.':'Destination still processing; do not resend.';results.push({operationId:w.operationId,state:w.state});}
 return {checked:results.length,remaining:s.receiptWatches.filter(x=>['due','pending'].includes(x.state)&&x.nextLookupAt<=now).length,results};
}
