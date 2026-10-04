import { z } from 'zod';
import { CONSENT_PERIOD_DAYS, consentStanding, fail, noticeInForce, noticesOf, person, uuid, type NoticeRef, type StandingState } from './core';
import { effective } from './abdm';
import type { Actor } from './store';
import type { Member, OrgState, Person, Role } from './types';

// Slice 6o: consent withdrawal and its downstream effects (BR-SEC-03, NFR-26).
// Withdrawing a permission stops or holds everything still waiting on it, lists what already left
// Saha without claiming to recall it, and appends one traceable event to the patient's consent
// history: who, when, how it was recorded, which permission version, and what happened to each item.
// The existing permission switch (setConsent) and contact-preference changes use the same record.
export type ConsentPurpose='ai'|'exchange'|'contact';
export type Disposition='stopped'|'in-flight'|'already-sent'|'kept';
export type DownstreamKind='programme-plan'|'programme-submission'|'ehr-permission'|'ehr-publication'|'abdm-consent'|'abdm-care-context'|'abdm-received'|'ai-request'|'ai-result'|'outreach-message';
export type DownstreamItem={kind:DownstreamKind;ref:string;before:string;after:string;disposition:Disposition;detail:string};
export type ConsentChannel='in-person'|'phone'|'written'|'switch'|'contact-preferences';
export type ConsentEvent={id:string;purpose:ConsentPurpose;action:'granted'|'withdrawn';at:string;by:string;byName:string;role:Role;channel:ConsentChannel;reference:string;reason:string;fromVersion:number;toVersion:number;items:DownstreamItem[];omitted?:number;notice?:NoticeRef|null;expiresAt?:string;renews?:{eventId:string;state:StandingState}};
// Bounds on the copy kept on the patient record. Every event is also in the audit chain, and every
// patient change writes a record revision holding the full patient document at that version.
export const MAX_ITEMS=100,MAX_HISTORY=100;
export const PURPOSE_LABEL:Record<ConsentPurpose,string>={ai:'Optional AI assistance',exchange:'External record sharing',contact:'Automated contact'};
const id=z.string().trim().min(1).max(200);
export const consentSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('withdrawConsent'),personId:id,version:z.number().int().positive(),purpose:z.enum(['ai','exchange','contact']),channel:z.enum(['in-person','phone','written']),reference:z.string().trim().min(3,'Give a reference of at least 3 characters.').max(200),reason:z.string().trim().min(10,'Write at least 10 characters.').max(1000)}).strict(),
]);
// Same shape as the core setConsent command; this module handles it so the switch cannot skip the downstream stop.
const setConsentSchema=z.object({type:z.enum(['setConsent']),personId:z.string().trim().min(1).max(200),purpose:z.enum(['ai','exchange']),active:z.boolean(),version:z.number().int().positive()});
const care=(m:Member)=>m.status==='active'&&['asha','clinician'].includes(m.role);
export function authorizeConsent(s:OrgState,m:Member,c:any){
 // Slice 14d: publishing a consent notice version is an owner decision (lib/saha/consent-notices.ts), checked on replay too.
 if(c?.type==='publishConsentNotice'){if(!m.isOwner||m.status!=='active')fail(403,'Only an organisation owner can publish consent notices.');return;}
 if(c?.type!=='withdrawConsent'&&c?.type!=='setConsent')return;
 if(!care(m))fail(403,'A care role with access to this patient records permission changes.');
 if(typeof c.personId==='string')person(s.workspace,c.personId);
}
export function granted(p:Person,purpose:ConsentPurpose){return purpose==='ai'?p.aiConsent:purpose==='exchange'?p.exchangeConsent:!!p.contactPreferences?.permission;}
const version=(p:Person,purpose:ConsentPurpose)=>purpose==='contact'?p.contactPreferences?.version??0:p.consentVersion;
export function recordConsent(p:Person,e:Omit<ConsentEvent,'id'>){
 const items=e.items.slice(0,MAX_ITEMS),omitted=e.items.length-items.length;
 const event:ConsentEvent={id:uuid(),...e,items,...(omitted?{omitted}:{})};
 const h=p.consentHistory??=[];h.push(event);
 // Slice 14d: the bound drops the oldest events but never the latest decision of a purpose, which decides its standing.
 if(h.length>MAX_HISTORY){const keep=new Set((['ai','exchange','contact'] as ConsentPurpose[]).map(x=>h.filter(y=>y.purpose===x).at(-1)?.id));let drop=h.length-MAX_HISTORY;for(let i=0;i<h.length&&drop>0;)if(keep.has(h[i].id))i++;else{h.splice(i,1);drop--;}}
 return event;
}
// Slice 14d (R90, BR-SEC-02): the terms a permission is given under (see core.ts consentStanding). When a notice is in force
// for the purpose, the command must name that version and a language it has text in: the notice the person was shown. An
// older or unknown version is refused, so a newer notice is never skipped. The expiry is set here from the purpose's period,
// never by the client. A permission given again while the last decision for its purpose was a grant renews that grant; the
// event records which one and whether it had lapsed. Automated contact has an expiry but no notice registry in this slice.
export const noticeChoiceSchema=z.object({id,language:z.enum(['en','hi'])}).strict();
export const NOTICE_LANGUAGE={en:'English',hi:'Hindi'} as const;
export function grantTerms(s:OrgState,p:Person,e:ConsentEvent,choice:unknown,now:string):Pick<ConsentEvent,'notice'|'expiresAt'|'renews'>{
 const notices=noticesOf(s),inForce=noticeInForce(notices,e.purpose,now),what=PURPOSE_LABEL[e.purpose].toLowerCase();let notice:NoticeRef|null|undefined;
 if(e.purpose==='contact'){if(choice!==undefined)fail(422,'Automated contact has no versioned notice in this build.');}
 else if(inForce){
  if(choice===undefined)fail(409,`Show the person the current ${what} notice (version ${inForce.version}) and record the language it was shown in before recording permission.`);
  const c=noticeChoiceSchema.safeParse(choice);if(!c.success)fail(422,'Name the notice that was shown and its language.');
  if(c.data.id!==inForce.id)fail(409,`The ${what} notice is now version ${inForce.version}. Show the person the current notice before recording permission.`);
  if(!inForce.texts[c.data.language])fail(422,`Notice version ${inForce.version} has no ${NOTICE_LANGUAGE[c.data.language]} text.`);
  notice={id:inForce.id,version:inForce.version,language:c.data.language};
 }
 else {if(choice!==undefined)fail(409,`No ${what} notice is in force. Refresh before recording permission.`);notice=null;}
 const others=(p.consentHistory??[]).filter(x=>x.id!==e.id),prev=others.filter(x=>x.purpose===e.purpose).at(-1);
 const renews=prev?.action==='granted'?{eventId:prev.id,state:consentStanding({...p,consentHistory:others},e.purpose,now,notices).state}:undefined;
 return {...(notice!==undefined?{notice}:{}),expiresAt:new Date(Date.parse(now)+CONSENT_PERIOD_DAYS[e.purpose]*86400000).toISOString(),...(renews?{renews}:{})};
}
// Stamps the terms on a grant event and writes them to the audit trail as their own event.
export function recordTerms(s:OrgState,p:Person,e:ConsentEvent,choice:unknown,u:Actor,m:Member,now:string){
 Object.assign(e,grantTerms(s,p,e,choice,now));
 const day=(x:string)=>x.slice(0,10),n=e.notice?noticesOf(s).find(x=>x.id===e.notice!.id):undefined,prior=e.renews?p.consentHistory?.find(x=>x.id===e.renews!.eventId):undefined;
 const under=e.purpose==='contact'?'no versioned notice for this purpose':n?`given under notice version ${n.version} (${NOTICE_LANGUAGE[e.notice!.language]}), in force since ${day(n.effectiveFrom)}`:'no notice is published for this purpose';
 const renewal=prior?`; renews the permission of ${day(prior.at)}${e.renews!.state==='expired'?', which had expired':e.renews!.state==='renewal-needed'?', which needed renewal after a material notice change':''}`:'';
 s.workspace.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:m.role,action:'consentTerms',subject:p.id,personId:p.id,detail:`${PURPOSE_LABEL[e.purpose]} permission: ${under}; expires ${day(e.expiresAt!)} (${CONSENT_PERIOD_DAYS[e.purpose]} days)${renewal}.`});
}
const day=(s?:string)=>(s??'').slice(0,10);
// Unexecuted plans carry the permission version; any permission change leaves them unusable.
function plans(s:OrgState,p:Person,items:DownstreamItem[]){
 for(const v of s.workspace.visits)if(v.personId===p.id&&v.plan&&['proposed','approved'].includes(v.plan.state)){const before=v.plan.state;v.plan.state='blocked';items.push({kind:'programme-plan',ref:v.plan.id,before,after:'blocked',disposition:'stopped',detail:`Unexecuted sharing plan from ${day(v.plan.createdAt)} blocked. A new plan needs current permission.`});}
}
function exchange(s:OrgState,p:Person,now:string,items:DownstreamItem[]){
 plans(s,p,items);
 for(const x of s.workspace.submissions){
  if(x.personId!==p.id)continue;
  if(x.state==='queued'||x.state==='retryable'){const before=x.state;x.state='cancelled';x.updatedAt=now;x.message='Cancelled: sharing permission withdrawn. Nothing further will be sent.';x.delivery?.events.push({at:now,state:'cancelled',detail:x.message});items.push({kind:'programme-submission',ref:x.id,before,after:'cancelled',disposition:'stopped',detail:`${x.connectorName}: unsent delivery cancelled${before==='retryable'?' (the destination had confirmed it held no record)':''}. Nothing was sent.`});}
  else if(x.state==='sending'||x.state==='uncertain')items.push({kind:'programme-submission',ref:x.id,before:x.state,after:x.state,disposition:'in-flight',detail:`${x.connectorName}: outcome not confirmed. Look up the receipt; it is never resent under the withdrawn permission. If it arrived, tell the destination through its own process.`});
  else if(x.state==='accepted')items.push({kind:'programme-submission',ref:x.id,before:x.state,after:x.state,disposition:'already-sent',detail:`${x.connectorName} accepted this record on ${day(x.updatedAt)}${x.receipt?` (receipt ${x.receipt})`:''}. Not recalled; the destination keeps its copy until told through its own process.`});
 }
 const e=p.ehr;
 if(e){
  for(const g of e.permissions)if(g.status==='active'){const expired=g.expiresAt<=now;g.status='revoked';items.push({kind:'ehr-permission',ref:g.id,before:expired?'expired':'active',after:'revoked',disposition:'stopped',detail:`EHR ${g.direction} permission${expired?' (already expired)':''} revoked. No further exchange uses it.`});}
  for(const o of e.operations){
   if(o.state==='prepared'){o.state='blocked';o.message='Blocked: sharing permission withdrawn before publication.';items.push({kind:'ehr-publication',ref:o.id,before:'prepared',after:'blocked',disposition:'stopped',detail:`EHR publication prepared on ${day(o.at)} blocked before sending.`});}
   else if(o.state==='running'||o.state==='uncertain')items.push({kind:'ehr-publication',ref:o.id,before:o.state,after:o.state,disposition:'in-flight',detail:`EHR publication from ${day(o.at)} has no confirmed outcome. Look it up; it is not resent.`});
   else if(o.state==='accepted')items.push({kind:'ehr-publication',ref:o.id,before:o.state,after:o.state,disposition:'already-sent',detail:`An EHR accepted a publication on ${day(o.at)}${o.receipt?` (receipt ${o.receipt})`:''}. Not recalled.`});
  }
 }
 for(const a of p.abdmConsents??[]){const st=effective(a,now);if(st==='GRANTED'||st==='REQUESTED'){a.status='REVOKED';a.revokedAt=now;a.revokeReason='Sharing permission withdrawn in Saha.';items.push({kind:'abdm-consent',ref:a.id,before:st,after:'REVOKED',disposition:'stopped',detail:`ABDM ${a.purpose} consent artefact (mock) revoked; further health-information fetches under it are refused.`});}}
 for(const c of p.careContexts??[])items.push({kind:'abdm-care-context',ref:c.id,before:'linked',after:'linked',disposition:'kept',detail:`Care context "${c.display}" stays linked with the mock gateway. Another facility still needs its own ABDM consent to fetch it; unlinking is not available in this build.`});
 for(const r of p.abdmReceived??[])items.push({kind:'abdm-received',ref:r.id,before:r.state,after:r.state,disposition:'kept',detail:`${r.hiType} received on ${day(r.receivedAt)} stays in the record under the retention policy; it is not deleted.`});
}
function ai(s:OrgState,p:Person,now:string,items:DownstreamItem[]){
 plans(s,p,items);
 for(const v of s.workspace.visits){
  if(v.personId!==p.id)continue;
  for(const r of v.agentRuns??[]){
   if(r.status==='pending'||r.status==='review'){const before=r.status,returned=r.finishedAt;r.status='cancelled';r.finishedAt=now;r.message=before==='pending'?'Stopped: AI permission withdrawn before the request was sent. Nothing was sent to a provider.':'Stopped: AI permission withdrawn. The returned output can no longer be applied; the request already sent is not recalled.';r.steps.filter(x=>x.state==='pending').forEach(x=>x.state='blocked');items.push({kind:'ai-request',ref:r.id,before,after:'cancelled',disposition:before==='pending'?'stopped':'already-sent',detail:before==='pending'?`${r.provider.name}: unsent request stopped. Nothing was sent.`:`${r.provider.name}: output from ${day(returned)} withdrawn from review and cannot be applied. ${r.provider.mode==='local'?'Local rules only; no data left Saha.':'The provider already received the input; it is not recalled.'}`});}
   else if(r.status==='running')items.push({kind:'ai-request',ref:r.id,before:'running',after:'running',disposition:'in-flight',detail:`${r.provider.name}: request in progress. Its output will be withheld on return because the permission changed.`});
  }
  for(const r of v.aiResults)items.push({kind:'ai-result',ref:r.id,before:r.reviewed?'reviewed':'unreviewed',after:r.reviewed?'reviewed':'unreviewed',disposition:'kept',detail:`${r.providerName} output from ${day(r.createdAt)} stays with the visit as a record of what was shown. ${r.mode==='demo'?'Demo output; no data left Saha.':'The provider already received the input; it is not recalled.'}`});
 }
}
export function contactWithdrawalItems(s:OrgState,p:Person,now:string,reason:string):DownstreamItem[]{
 const items:DownstreamItem[]=[];
 for(const v of s.outreach?.messages??[]){
  if(v.personId!==p.id)continue;
  if(['draft','approved','failed'].includes(v.state)){const before=v.state;v.state='cancelled';v.cancelReason=reason;v.version++;items.push({kind:'outreach-message',ref:v.id,before,after:'cancelled',disposition:'stopped',detail:`Reminder planned for ${day(v.scheduledAt)} cancelled before sending.`});}
  else if(v.state==='simulated')items.push({kind:'outreach-message',ref:v.id,before:v.state,after:v.state,disposition:'already-sent',detail:`Reminder simulated on ${day(v.attempts.at(-1)?.at)}. A delivered message cannot be recalled.`});
 }
 return items;
}
const summary=(items:DownstreamItem[])=>{const n=(d:Disposition)=>items.filter(i=>i.disposition===d).length;return `${n('stopped')} stopped, ${n('in-flight')} awaiting a receipt, ${n('already-sent')} already sent (not recalled), ${n('kept')} kept.`;};
// Withdraws one permission and applies its downstream effects. Returns the recorded event.
function withdraw(s:OrgState,p:Person,purpose:ConsentPurpose,u:Actor,m:Member,now:string,channel:ConsentChannel,reference:string,reason:string){
 const from=version(p,purpose),items:DownstreamItem[]=[];
 if(purpose==='contact'){const c=p.contactPreferences;if(c){c.permission=false;c.version++;c.updatedAt=now;c.by=u.userId;}items.push(...contactWithdrawalItems(s,p,now,'Contact permission withdrawn.'));}
 else {if(purpose==='ai')p.aiConsent=false;else p.exchangeConsent=false;p.consentVersion++;(purpose==='ai'?ai:exchange)(s,p,now,items);}
 return recordConsent(p,{purpose,action:'withdrawn',at:now,by:u.userId,byName:u.displayName,role:m.role,channel,reference,reason,fromVersion:from,toVersion:version(p,purpose),items});
}
export function applyConsent(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const t=(input as any)?.type;if(t!=='withdrawConsent'&&t!=='setConsent')return null;
 authorizeConsent(s,m,input);const w=s.workspace;let e:ConsentEvent,action=t;
 if(t==='withdrawConsent'){
  const parsed=consentSchema.safeParse(input);if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid permission withdrawal.');const c=parsed.data,p=person(w,c.personId);
  if(p.version!==c.version)fail(409,'This patient record has changed. Refresh before recording the withdrawal.');
  if(!granted(p,c.purpose))fail(409,`${PURPOSE_LABEL[c.purpose]} is not currently permitted, so there is nothing to withdraw.`);
  if(c.purpose==='contact'&&!p.contactPreferences)fail(409,'No contact preferences are recorded for this patient.');
  e=withdraw(s,p,c.purpose,u,m,now,c.channel,c.reference,c.reason);
 } else {
  const parsed=setConsentSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data,p=person(w,c.personId);
  if(p.version!==c.version)fail(409,'This patient record has changed. Refresh before updating permission.');
  if(c.active){const from=p.consentVersion;if(c.purpose==='ai')p.aiConsent=true;else p.exchangeConsent=true;p.consentVersion++;const items:DownstreamItem[]=[];plans(s,p,items);e=recordConsent(p,{purpose:c.purpose,action:'granted',at:now,by:u.userId,byName:u.displayName,role:m.role,channel:'switch',reference:'',reason:'',fromVersion:from,toVersion:p.consentVersion,items});}
  else e=withdraw(s,p,c.purpose,u,m,now,'switch','','Recorded with the permission switch.');
  action='setConsent';
  // Slice 14d: a permission given records the notice it was given under and its expiry (grantTerms above).
  if(e.action==='granted')recordTerms(s,p,e,(input as any).notice,u,m,now);
 }
 const label=PURPOSE_LABEL[e.purpose];
 w.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:m.role,action,subject:(input as any).personId,personId:(input as any).personId,detail:e.action==='granted'?`${label} permission recorded (version ${e.fromVersion} to ${e.toVersion}).`:`${label} permission withdrawn (version ${e.fromVersion} to ${e.toVersion}${e.channel!=='switch'?`, ${e.channel}, reference ${e.reference}`:''}). ${summary(e.items)} Already shared records are not recalled.`});
 return {eventId:e.id,purpose:e.purpose,action:e.action,version:e.toVersion,items:e.items.length,stopped:e.items.filter(i=>i.disposition==='stopped').length,inFlight:e.items.filter(i=>i.disposition==='in-flight').length,alreadySent:e.items.filter(i=>i.disposition==='already-sent').length};
}
