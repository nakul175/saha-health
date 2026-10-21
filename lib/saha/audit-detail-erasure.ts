import {contentDigest,sha256,type EventRow,type Verification} from './audit-chain';
import {fail} from './core';
import {decidePolicyDisposition,type DispositionDecision} from './retention-class-policy';

export const AUDIT_MINIMUM_ENVELOPE_VERSION='saha-audit-minimum-envelope-v1';
export type AuditDetailAuthority={approved:boolean;approvalReference:string;design:'cryptographic'|'checkpoint-linked';detailProtection:'plaintext'|'encrypted-v1'|'checkpoint-token-v1';detailEligibleAt:string;hold:boolean;exception?:boolean};
export type AuditMinimumEnvelope={version:typeof AUDIT_MINIMUM_ENVELOPE_VERSION;organisationId:string;eventId:string;at:string;actorId:string;authorityClass:string;action:string;subjectToken:string;seq:number;prevHash:string;eventHash:string;contentDigest:string};
export type AuditDetailErasurePlan={envelope:AuditMinimumEnvelope;design:AuditDetailAuthority['design'];approvalReference:string;sourceBinding:string;preparedAt:string};
export type AuditDetailProof={design:AuditDetailAuthority['design'];detailUnavailable:boolean;keyInaccessible?:boolean;checkpoint?:{seq:number;hash:string}};

const canonicalInstant=(value:string,label:string)=>{const d=new Date(value);if(!Number.isFinite(d.valueOf())||d.toISOString()!==value)fail(422,`${label} must be a canonical UTC instant.`);return value;};
const chained=(event:EventRow)=>{if(!Number.isInteger(event.seq)||(event.seq??-1)<0||!event.hash||!/^[0-9a-f]{64}$/.test(event.hash)||!event.prev_hash||!/^[0-9a-f]{64}$/.test(event.prev_hash))fail(409,'Only a fully chained audit event can enter detail erasure review.');return event as EventRow&{seq:number;hash:string;prev_hash:string};};
const approval=(authority:AuditDetailAuthority)=>{if(!authority.approved||authority.approvalReference.trim().length<3)fail(409,'Approved audit-detail authority is required.');if(authority.hold||authority.exception)fail(409,'A legal hold, clinical duty or recorded exception requires full audit retention.');canonicalInstant(authority.detailEligibleAt,'Audit detail eligibility');};

// Produces a bound plan only. It does not mutate the append-only audit row and
// cannot turn plaintext into erasable content. New writes need a separately
// reviewed encryption/token adapter before this gate can complete.
export async function prepareAuditDetailErasure(event:EventRow,authority:AuditDetailAuthority,verification:Verification,now=new Date().toISOString()):Promise<AuditDetailErasurePlan>{
 approval(authority);canonicalInstant(now,'Preparation time');const current=chained(event);
 if(verification.status!=='intact'||!verification.head||verification.head.seq<current.seq||verification.firstBreak)fail(409,'An intact audit chain through this event is required.');
 if(authority.detailEligibleAt>now)fail(409,'The sensitive-detail retention window has not elapsed.');
 if(authority.design==='cryptographic'&&authority.detailProtection!=='encrypted-v1')fail(409,'Cryptographic erasure requires detail encrypted under an independently erasable key.');
 if(authority.design==='checkpoint-linked'&&authority.detailProtection!=='checkpoint-token-v1')fail(409,'Checkpoint-linked erasure requires a pre-existing content token; plaintext rewriting is refused.');
 const digest=await contentDigest(current),subjectToken=await sha256(JSON.stringify([AUDIT_MINIMUM_ENVELOPE_VERSION,current.org_id,current.subject]));
 const envelope:AuditMinimumEnvelope={version:AUDIT_MINIMUM_ENVELOPE_VERSION,organisationId:current.org_id,eventId:current.id,at:current.at,actorId:current.actor_id,authorityClass:current.role,action:current.action,subjectToken,seq:current.seq,prevHash:current.prev_hash,eventHash:current.hash,contentDigest:digest};
 return {envelope,design:authority.design,approvalReference:authority.approvalReference,sourceBinding:await sha256(JSON.stringify(envelope)),preparedAt:now};
}

export async function confirmAuditDetailErasure(plan:AuditDetailErasurePlan,current:EventRow,proof:AuditDetailProof,verification:Verification):Promise<DispositionDecision>{
 const event=chained(current),digest=await contentDigest(event),binding=await sha256(JSON.stringify(plan.envelope));
 if(binding!==plan.sourceBinding||event.org_id!==plan.envelope.organisationId||event.id!==plan.envelope.eventId||event.seq!==plan.envelope.seq||event.hash!==plan.envelope.eventHash||event.prev_hash!==plan.envelope.prevHash||digest!==plan.envelope.contentDigest)fail(409,'The audit event changed after erasure preparation. No completion was recorded.');
 if(verification.status!=='intact'||!verification.head||verification.head.seq<event.seq||verification.firstBreak)fail(409,'The audit chain is not intact through the prepared event.');
 if(proof.design!==plan.design)fail(409,'The detail-erasure proof uses a different approved design.');
 if(plan.design==='checkpoint-linked'&&(!proof.checkpoint||proof.checkpoint.seq!==verification.head.seq||proof.checkpoint.hash!==verification.head.hash))fail(409,'The checkpoint proof does not bind the verified chain head.');
 return decidePolicyDisposition({recordClass:'audit-event',hold:false,detailErasureDesign:plan.design,minimumEnvelopeRetained:true,chainVerified:true,detailUnavailable:proof.detailUnavailable,...(plan.design==='cryptographic'?{detailKeyInaccessible:proof.keyInaccessible===true}:{})});
}
