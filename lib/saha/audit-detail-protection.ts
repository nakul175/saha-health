import type {D1Database,D1PreparedStatement} from '@cloudflare/workers-types';
import {contentDigest,sha256,type EventRow} from './audit-chain';
import {fail} from './core';

export const AUDIT_DETAIL_TOKEN_FORMAT='saha-audit-detail-ciphertext-v1';
export type AuditDetailSeal={keyId:string;keyVersion:string;algorithm:string;nonce:string;ciphertext:string;lifecycleToken:string};
export type AuditDetailKeyProvider={
 seal(input:{plaintext:string;aad:string;keyPurpose:'audit-detail'}):Promise<AuditDetailSeal>;
 destroy(input:{keyId:string;keyVersion:string;expectedLifecycleToken:string}):Promise<{state:'inaccessible'|'pending'|'mismatch';receipt:string|null}>;
};
export type AuditDetailProtectionMetadata={orgId:string;eventId:string;keyId:string;keyVersion:string;algorithm:string;tokenDigest:string;lifecycleTokenDigest:string;eligibleAt:string;createdAt:string};
export type ProtectedAuditDetail={event:EventRow;metadata:AuditDetailProtectionMetadata};

const canonical=(value:string,label:string)=>{const d=new Date(value);if(!Number.isFinite(d.valueOf())||d.toISOString()!==value)fail(422,`${label} must be a canonical UTC instant.`);return value;};
const bounded=(value:string,label:string,max:number)=>{if(!value||value.length>max)fail(503,`${label} is unavailable or exceeds its safe limit.`);return value;};
const aadFor=(e:EventRow)=>JSON.stringify([AUDIT_DETAIL_TOKEN_FORMAT,e.org_id,e.id,e.person_id??null,e.actor_id,e.role,e.action,e.subject,e.at]);
export function parseAuditDetailToken(detail:string):AuditDetailSeal|null{try{const x=JSON.parse(detail);if(!x||Object.keys(x).sort().join(',')!=='algorithm,ciphertext,format,keyId,keyVersion,nonce'||x.format!==AUDIT_DETAIL_TOKEN_FORMAT||![x.keyId,x.keyVersion,x.algorithm,x.nonce,x.ciphertext].every(v=>typeof v==='string'&&v.length>0))return null;return {keyId:x.keyId,keyVersion:x.keyVersion,algorithm:x.algorithm,nonce:x.nonce,ciphertext:x.ciphertext,lifecycleToken:''};}catch{return null;}}

// Called before linkRows: ciphertext, rather than plaintext, becomes immutable
// chain content. Historical chained plaintext is deliberately ineligible.
export async function protectAuditDetailAtWrite(event:EventRow,provider:AuditDetailKeyProvider,eligibleAt:string,createdAt=new Date().toISOString()):Promise<ProtectedAuditDetail>{
 canonical(eligibleAt,'Audit detail eligibility');canonical(createdAt,'Audit detail protection time');if(eligibleAt<=createdAt)fail(422,'Audit detail eligibility must be after protection time.');
 if(event.seq!=null||event.prev_hash!=null||event.hash!=null)fail(409,'Audit detail protection must happen before the event is linked.');
 bounded(event.detail,'Audit detail',8000);const sealed=await provider.seal({plaintext:event.detail,aad:aadFor(event),keyPurpose:'audit-detail'});
 for(const [label,value,max] of [['key id',sealed.keyId,200],['key version',sealed.keyVersion,200],['algorithm',sealed.algorithm,100],['nonce',sealed.nonce,1000],['ciphertext',sealed.ciphertext,16000],['lifecycle token',sealed.lifecycleToken,1000]] as const)bounded(value,label,max);
 const token=JSON.stringify({format:AUDIT_DETAIL_TOKEN_FORMAT,keyId:sealed.keyId,keyVersion:sealed.keyVersion,algorithm:sealed.algorithm,nonce:sealed.nonce,ciphertext:sealed.ciphertext}),protectedEvent={...event,detail:token};
 return {event:protectedEvent,metadata:{orgId:event.org_id,eventId:event.id,keyId:sealed.keyId,keyVersion:sealed.keyVersion,algorithm:sealed.algorithm,tokenDigest:await sha256(token),lifecycleTokenDigest:await sha256(sealed.lifecycleToken),eligibleAt,createdAt}};
}

export function auditDetailProtectionStatements(d:D1Database,metadata:AuditDetailProtectionMetadata,lifecycleToken:string,id:string):D1PreparedStatement[]{return [
 d.prepare('INSERT INTO audit_detail_protections (org_id,event_id,key_id,key_version,algorithm,token_digest,lifecycle_token_digest,eligible_at,created_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(metadata.orgId,metadata.eventId,metadata.keyId,metadata.keyVersion,metadata.algorithm,metadata.tokenDigest,metadata.lifecycleTokenDigest,metadata.eligibleAt,metadata.createdAt),
 d.prepare("INSERT INTO audit_detail_key_events (org_id,id,event_id,phase,outcome,key_id,key_version,lifecycle_token_digest,at,receipt) VALUES (?,?,?,'sealed','key-created',?,?,?,?,?,NULL)").bind(metadata.orgId,id,metadata.eventId,metadata.keyId,metadata.keyVersion,metadata.lifecycleTokenDigest,metadata.createdAt)
];}

export async function destroyAuditDetailKey(provider:AuditDetailKeyProvider,event:EventRow,metadata:AuditDetailProtectionMetadata,lifecycleToken:string,now=new Date().toISOString()){
 canonical(now,'Audit detail destruction time');if(now<metadata.eligibleAt)fail(409,'The audit detail retention window has not elapsed.');const parsed=parseAuditDetailToken(event.detail);if(!parsed)fail(409,'The audit event does not contain protected detail.');
 if(event.org_id!==metadata.orgId||event.id!==metadata.eventId||parsed.keyId!==metadata.keyId||parsed.keyVersion!==metadata.keyVersion||parsed.algorithm!==metadata.algorithm||await sha256(event.detail)!==metadata.tokenDigest||await sha256(lifecycleToken)!==metadata.lifecycleTokenDigest)fail(409,'Audit detail protection metadata changed. No key action was taken.');
 const sourceDigest=await contentDigest(event),result=await provider.destroy({keyId:metadata.keyId,keyVersion:metadata.keyVersion,expectedLifecycleToken:lifecycleToken});if(result.state==='mismatch')fail(409,'Audit detail key lifecycle changed. No completion was recorded.');
 return {state:result.state,detailUnavailable:result.state==='inaccessible',keyInaccessible:result.state==='inaccessible',receipt:result.receipt,sourceDigest,at:now};
}
