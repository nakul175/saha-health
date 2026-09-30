import { z } from 'zod';
import { fail, person, uuid } from './core';
import { TERMINAL } from './referral-rules';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';

// Slice 1c: controlled identity merge and unmerge (BR-ID-08, BR-ID-05, journey J04).
// A merge is a link, not a data move: the duplicate keeps its visits, receipts and history,
// points at the surviving record and stops accepting new care. Two different identity stewards
// are required, pending approvals on the duplicate are invalidated, and every downstream effect
// that software cannot safely repair becomes an item in the impact queue.
export type Ident={name:string;age:number;sex:string;village:string};
export type MergeItemKind='programme-record'|'ehr-link'|'referral'|'follow-up'|'enrolment'|'household'|'proxy'|'post-merge-review';
export type MergeItem={id:string;kind:MergeItemKind;personId:string;ref:string;detail:string;state:'open'|'resolved';createdAt:string;resolved?:{by:string;at:string;note:string}};
export type MergeCase={id:string;version:number;survivorId:string;duplicateId:string;state:'proposed'|'merged'|'rejected'|'unmerged';reason:string;evidence:string;snapshot:{survivor:Ident;duplicate:Ident};proposedBy:string;proposedAt:string;
 decided?:{by:string;at:string;decision:'approve'|'reject';reason:string};unmerged?:{by:string;at:string;reason:string};invalidated?:{plans:number;leases:number;messages:number};items:MergeItem[]};
export type MergeLink={personId:string;caseId:string;at:string;unmergedAt?:string};
const id=z.string().trim().min(1).max(200),version=z.number().int().positive(),reason=z.string().trim().min(10,'Explain the reason in at least 10 characters.').max(1000),note=z.string().trim().min(5,'Add a note of at least 5 characters.').max(1000);
export const mergeSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('identityMergePropose'),survivorId:id,duplicateId:id,evidence:z.string().trim().min(3).max(200),reason}).strict(),
 z.object({type:z.literal('identityMergeDecide'),caseId:id,version,decision:z.enum(['approve','reject']),reason}).strict(),
 z.object({type:z.literal('identityUnmerge'),caseId:id,version,reason}).strict(),
 z.object({type:z.literal('identityImpactResolve'),caseId:id,version,itemId:id,note}).strict(),
]);
const TYPES=new Set(['identityMergePropose','identityMergeDecide','identityUnmerge','identityImpactResolve']);
export const MAX_CASES=1000,MAX_ITEMS=200;
const ident=(p:Person):Ident=>({name:p.name,age:p.age,sex:p.sex,village:p.village});
const same=(a:Ident,b:Ident)=>a.name===b.name&&a.age===b.age&&a.sex===b.sex&&a.village===b.village;
export function stewardRole(m:Member){return m.status==='active'&&(m.role==='clinician'||m.role==='supervisor');}
function steward(m:Member){if(!stewardRole(m))fail(403,'An identity steward (clinician or supervisor with access to both records) is required.');}
function caseFor(s:OrgState,caseId:string,v?:number){const c=(s.identityCases??[]).find(x=>x.id===caseId);if(!c)fail(404,'Identity case not found.');if(v!==undefined&&c.version!==v)fail(409,'This identity case changed. Refresh before continuing.');return c;}
export function authorizeMerge(s:OrgState,m:Member,c:any){
 if(!TYPES.has(c?.type))return;steward(m);
 if(c.type==='identityMergePropose'){person(s.workspace,c.survivorId);person(s.workspace,c.duplicateId);return;}
 const k=caseFor(s,c.caseId);person(s.workspace,k.survivorId);person(s.workspace,k.duplicateId);
 if(c.type==='identityMergeDecide'&&k.proposedBy===m.userId)fail(403,'A different identity steward must review this proposal.');
}
const activeLinks=(p:Person)=>(p.ehr?.links??[]).filter(l=>l.status==='active');
function mergeable(s:OrgState,survivor:Person,duplicate:Person,ignore?:string){
 if(survivor.id===duplicate.id)fail(422,'Choose two different records.');
 if(survivor.mergedInto||duplicate.mergedInto)fail(409,'One of these records is already merged into another record.');
 if((duplicate.mergedFrom??[]).some(x=>!x.unmergedAt))fail(409,'The duplicate already has records merged into it. Merge into that record directly, or unmerge first.');
 if((s.identityCases??[]).some(k=>k.id!==ignore&&k.state==='proposed'&&[k.survivorId,k.duplicateId].some(x=>x===survivor.id||x===duplicate.id)))fail(409,'One of these records already has an open merge proposal.');
 const a=activeLinks(survivor),b=activeLinks(duplicate);
 if(a.some(x=>b.some(y=>y.integrationId===x.integrationId&&y.externalId!==x.externalId)))fail(409,'The records are linked to different external identities in the same system. Revoke the wrong link before merging.');
}
// Actions refused on a merged record. Reconciliation of existing external work, closing open
// work and revoking links or leases stay possible so the impact queue can be worked down.
export const BLOCKED_WHEN_MERGED=new Set(['startVisit','saveVisit','confirmVisit','preparePlan','approvePlan','executePlan','runAI','reviewAI','createReferral','createDirectoryReferral','amendVisit','correctIdentity','assignPatient','enrolProgramme','scheduleFollowUp','saveProgrammeAnswers','prepareFieldVisit','setConsent','setContactPreferences','linkEhr','grantEhrPermission','importEhrDocument','prepareEhrPublish','executeEhrPublish','sendSubmission','messageCreate','messageApprove','prepareAgent','executeAgent','applyAgent','householdCreate','householdAddMember','proxyGrant','identityMergePropose','checkProtocol','saveClinicalConcern']);
export function ensureNotMerged(s:OrgState,c:any){
 if(!BLOCKED_WHEN_MERGED.has(c.type))return;const w=s.workspace;
 let pid:string|undefined=c.type==='identityMergePropose'?undefined:c.personId;
 if(c.visitId)pid=w.visits.find(v=>v.id===c.visitId)?.personId;if(c.submissionId)pid=w.submissions.find(v=>v.id===c.submissionId)?.personId;if(c.messageId)pid=s.outreach?.messages.find(v=>v.id===c.messageId)?.personId;
 const p=pid?w.people.find(x=>x.id===pid):undefined;
 if(p?.mergedInto)fail(409,'This record was merged into another record. Record new care on the surviving record; open items are listed in the merge impact queue.');
}
function item(kind:MergeItemKind,personId:string,ref:string,detail:string,now:string):MergeItem{return {id:uuid(),kind,personId,ref,detail,state:'open',createdAt:now};}
// Consequences of approving a merge, applied to the duplicate. Returns queue items for what software must not repair itself.
function mergeEffects(s:OrgState,d:Person,now:string){
 const w=s.workspace,items:MergeItem[]=[];let plans=0,leases=0,messages=0;
 for(const v of w.visits)if(v.personId===d.id&&v.plan&&['proposed','approved'].includes(v.plan.state)){v.plan.state='blocked';plans++;}
 for(const l of d.fieldLeases??[])if(l.status==='active'){l.status='revoked';leases++;}
 for(const m of s.outreach?.messages??[])if(m.personId===d.id&&['draft','approved','failed'].includes(m.state)){m.state='cancelled';m.cancelReason='Record merged into another record. Prepare any reminder on the surviving record.';m.version++;messages++;}
 for(const x of w.submissions)if(x.personId===d.id&&['accepted','uncertain','queued','sending','retryable'].includes(x.state))items.push(item('programme-record',d.id,x.id,`${x.connectorName}: ${x.state} submission from this record. Confirm with the destination which identity it holds and issue any correction through its process.`,now));
 for(const l of activeLinks(d))items.push(item('ehr-link',d.id,l.id,`Active EHR link to ${l.externalName}. Decide whether it belongs to the surviving record; revoke it here if not.`,now));
 for(const r of w.referrals)if(r.personId===d.id&&!TERMINAL.has(r.state))items.push(item('referral',d.id,r.id,`Open referral to ${r.facility} (${r.state}). Tell the facility which record to use; close it here once resolved.`,now));
 for(const f of d.followUps??[])if(f.state==='open')items.push(item('follow-up',d.id,f.id,`Open follow-up "${f.title}" due ${f.due}. Recreate it on the surviving record if still needed, then resolve it here.`,now));
 for(const e of d.enrolments??[])if(e.state==='active')items.push(item('enrolment',d.id,e.id,`Active ${e.packId} episode "${e.episodeLabel}". Enrol the surviving record if appropriate and close this episode.`,now));
 if(d.householdId)items.push(item('household',d.id,d.householdId,'Household membership on the duplicate. End it and add the surviving record if appropriate.',now));
 for(const g of d.proxies??[])if(!g.revokedAt&&g.expiresAt>now)items.push(item('proxy',d.id,g.id,'Current proxy grant on the duplicate. Record it again on the surviving record if the authority still applies, then revoke it here.',now));
 return {items,invalidated:{plans,leases,messages}};
}
export function applyMerge(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const parsed=mergeSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeMerge(s,m,c);
 s.identityCases??=[];const w=s.workspace;let subject='',personId:string|undefined,detail='',result:any={ok:true};
 if(c.type==='identityMergePropose'){
  const survivor=person(w,c.survivorId),duplicate=person(w,c.duplicateId);mergeable(s,survivor,duplicate);
  if(s.identityCases.length>=MAX_CASES)fail(422,'Identity case limit reached; an archival policy is required.');
  const k:MergeCase={id:uuid(),version:1,survivorId:survivor.id,duplicateId:duplicate.id,state:'proposed',reason:c.reason,evidence:c.evidence,snapshot:{survivor:ident(survivor),duplicate:ident(duplicate)},proposedBy:u.userId,proposedAt:now,items:[]};
  s.identityCases.push(k);subject=k.id;personId=duplicate.id;detail=`Merge proposed: this record as a duplicate of ${survivor.name}. Evidence ${c.evidence}. Awaiting a different steward. Reason: ${c.reason}`;result={caseId:k.id};
 }
 else if(c.type==='identityMergeDecide'){
  const k=caseFor(s,c.caseId,c.version);if(k.state!=='proposed')fail(409,'Only a proposed merge can be decided.');
  const survivor=person(w,k.survivorId),duplicate=person(w,k.duplicateId);subject=k.id;personId=duplicate.id;
  if(c.decision==='reject'){k.state='rejected';k.decided={by:u.userId,at:now,decision:'reject',reason:c.reason};detail=`Merge proposal rejected; records remain separate. Reason: ${c.reason}`;}
  else {
   if(!same(ident(survivor),k.snapshot.survivor)||!same(ident(duplicate),k.snapshot.duplicate))fail(409,'Identity details changed after the proposal. Reject it and propose again with current details.');
   mergeable(s,survivor,duplicate,k.id);
   const effects=mergeEffects(s,duplicate,now);if(effects.items.length>MAX_ITEMS)fail(422,'Too many downstream items for one merge; resolve open work on the duplicate first.');
   duplicate.mergedInto={personId:survivor.id,caseId:k.id,at:now};duplicate.version++;
   (survivor.mergedFrom??=[]).push({personId:duplicate.id,caseId:k.id,at:now});survivor.version++;
   k.state='merged';k.decided={by:u.userId,at:now,decision:'approve',reason:c.reason};k.items=effects.items;k.invalidated=effects.invalidated;
   detail=`Merge approved: record now points to ${survivor.name}. Original visits, receipts and history retained. ${effects.invalidated.plans} pending approvals invalidated, ${effects.invalidated.leases} field packages revoked, ${effects.invalidated.messages} reminders cancelled; ${effects.items.length} downstream items queued. Reason: ${c.reason}`;
   result={caseId:k.id,items:effects.items.length,invalidated:effects.invalidated};
  }
  k.version++;
 }
 else if(c.type==='identityUnmerge'){
  const k=caseFor(s,c.caseId,c.version);if(k.state!=='merged')fail(409,'Only a merged case can be unmerged.');
  const survivor=person(w,k.survivorId),duplicate=person(w,k.duplicateId);const since=k.decided!.at;
  if(duplicate.mergedInto?.caseId!==k.id)fail(409,'The duplicate no longer points to this case.');
  delete duplicate.mergedInto;duplicate.version++;
  const link=(survivor.mergedFrom??[]).find(x=>x.caseId===k.id);if(link)link.unmergedAt=now;survivor.version++;
  const added:MergeItem[]=[];
  for(const v of w.visits)if(v.personId===survivor.id&&v.createdAt>=since)added.push(item('post-merge-review',survivor.id,v.id,`Visit started ${v.createdAt.slice(0,10)} while the records were merged. Confirm it belongs to ${survivor.name}; correct it if not.`,now));
  for(const x of w.submissions)if(x.personId===survivor.id&&x.createdAt>=since)added.push(item('post-merge-review',survivor.id,x.id,`${x.connectorName} submission made while the records were merged. Confirm the destination holds the right identity.`,now));
  for(const r of w.referrals)if(r.personId===survivor.id&&r.createdAt>=since)added.push(item('post-merge-review',survivor.id,r.id,`Referral to ${r.facility} created while the records were merged. Confirm the facility has the right person.`,now));
  if(k.items.length+added.length>MAX_ITEMS*2)fail(422,'Too many downstream items for one case.');
  k.items.push(...added);k.state='unmerged';k.unmerged={by:u.userId,at:now,reason:c.reason};k.version++;subject=k.id;personId=duplicate.id;
  detail=`Merge reversed: both records active again. ${added.length} records created while merged queued for review. Reason: ${c.reason}`;result={caseId:k.id,added:added.length};
 }
 else {
  const k=caseFor(s,c.caseId,c.version);if(!['merged','unmerged'].includes(k.state))fail(409,'This case has no impact queue.');
  const i=k.items.find(x=>x.id===c.itemId);if(!i)fail(404,'Impact item not found.');if(i.state!=='open')fail(409,'This item is already resolved.');
  person(w,i.personId);i.state='resolved';i.resolved={by:u.userId,at:now,note:c.note};k.version++;subject=k.id;personId=i.personId;detail=`Merge impact item resolved (${i.kind}): ${c.note}`;
 }
 w.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject,personId,detail});
 return result;
}
// Cases involving one person, with the counterpart named only when the viewer may see it.
export function mergeView(s:OrgState,m:Member,personId:string){
 const p=person(s.workspace,personId),seen=(id:string)=>{const q=s.workspace.people.find(x=>x.id===id);return q?.assigned?{id:q.id,name:q.name,age:q.age,village:q.village,version:q.version}:{id:null,name:'A record outside your scope',age:null,village:null,version:null};};
 const cases=(s.identityCases??[]).filter(k=>k.survivorId===p.id||k.duplicateId===p.id).sort((a,b)=>b.proposedAt.localeCompare(a.proposedAt)).map(k=>{const both=!!s.workspace.people.find(x=>x.id===k.survivorId)?.assigned&&!!s.workspace.people.find(x=>x.id===k.duplicateId)?.assigned;
  return {id:k.id,version:k.version,state:k.state,role:k.survivorId===p.id?'survivor':'duplicate',survivor:seen(k.survivorId),duplicate:seen(k.duplicateId),reason:k.reason,evidence:k.evidence,proposedAt:k.proposedAt,proposedBySelf:k.proposedBy===m.userId,decided:k.decided??null,unmerged:k.unmerged??null,invalidated:k.invalidated??null,
   items:both?k.items:k.items.filter(i=>i.personId===p.id),openItems:k.items.filter(i=>i.state==='open').length,
   canDecide:stewardRole(m)&&both&&k.state==='proposed'&&k.proposedBy!==m.userId,canUnmerge:stewardRole(m)&&both&&k.state==='merged',canResolve:stewardRole(m)};});
 return {personId:p.id,mergedInto:p.mergedInto?{...p.mergedInto,survivor:seen(p.mergedInto.personId)}:null,canPropose:stewardRole(m)&&!p.mergedInto,cases,rule:'A merge links the duplicate to the surviving record without moving or deleting data. Two different identity stewards are required. Pending approvals on the duplicate are invalidated and anything software cannot safely repair is queued for a person to resolve.'};
}
