import { z } from 'zod';
import { fail, person, uuid } from './core';
import { effective } from './abdm';
import { activeGrant } from './household';
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
export type ConsentEvent={id:string;purpose:ConsentPurpose;action:'granted'|'withdrawn';at:string;by:string;byName:string;role:Role;channel:ConsentChannel;reference:string;reason:string;fromVersion:number;toVersion:number;items:DownstreamItem[];omitted?:number};
export const CONSENT_SCOPES=['ai-assistance','optional-audio-recording','external-record-sharing'] as const;
export type ConsentScope=typeof CONSENT_SCOPES[number];
export type ConsentNotice={id:string;purpose:'ai'|'exchange';language:'en'|'hi';version:string;title:string;body:string;scopes:ConsentScope[];expiryRequired:boolean;proposedBy:string;proposedAt:string;review?:{decision:'approved'|'changes';by:string;at:string;reference:string;note:string}};
export type ConsentDecision={id:string;purpose:'ai'|'exchange';noticeId:string;noticeVersion:string;language:'en'|'hi';scopes:ConsentScope[];decision:'granted'|'declined';authority:'self'|'representative';representativePersonId?:string;proxyGrantId?:string;expiresAt?:string;at:string;by:string;channel:'in-person'|'phone'|'written'};
// Bounds on the copy kept on the patient record. Every event is also in the audit chain, and every
// patient change writes a record revision holding the full patient document at that version.
export const MAX_ITEMS=100,MAX_HISTORY=100;
export const PURPOSE_LABEL:Record<ConsentPurpose,string>={ai:'Optional AI assistance',exchange:'External record sharing',contact:'Automated contact'};
const id=z.string().trim().min(1).max(200);
export const consentSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('withdrawConsent'),personId:id,version:z.number().int().positive(),purpose:z.enum(['ai','exchange','contact']),channel:z.enum(['in-person','phone','written']),reference:z.string().trim().min(3,'Give a reference of at least 3 characters.').max(200),reason:z.string().trim().min(10,'Write at least 10 characters.').max(1000)}).strict(),
 z.object({type:z.literal('consentNoticePropose'),language:z.enum(['en','hi']),version:z.string().trim().regex(/^v[1-9][0-9]{0,5}$/),purpose:z.enum(['ai','exchange']),title:z.string().trim().min(5).max(160),body:z.string().trim().min(30).max(4000),scopes:z.array(z.enum(CONSENT_SCOPES)).min(1).max(CONSENT_SCOPES.length).refine(x=>new Set(x).size===x.length,'List each scope once.'),expiryRequired:z.boolean()}).strict(),
 z.object({type:z.literal('consentNoticeReview'),noticeId:id,decision:z.enum(['approved','changes']),reference:z.string().trim().min(3).max(200),note:z.string().trim().min(10).max(1000)}).strict(),
 z.object({type:z.literal('recordConsentDecision'),personId:id,version:z.number().int().positive(),noticeId:id,decision:z.enum(['granted','declined']),authority:z.enum(['self','representative']),representativePersonId:id.optional(),proxyGrantId:id.optional(),expiresAt:z.string().datetime().nullable(),channel:z.enum(['in-person','phone','written'])}).strict(),
]);
// Same shape as the core setConsent command; this module handles it so the switch cannot skip the downstream stop.
const setConsentSchema=z.object({type:z.enum(['setConsent']),personId:z.string().trim().min(1).max(200),purpose:z.enum(['ai','exchange']),active:z.boolean(),version:z.number().int().positive()});
const care=(m:Member)=>m.status==='active'&&['asha','clinician'].includes(m.role);
export function authorizeConsent(s:OrgState,m:Member,c:any){
 if(!['withdrawConsent','setConsent','consentNoticePropose','consentNoticeReview','recordConsentDecision'].includes(c?.type))return;
 if(c.type==='consentNoticePropose'){if(!m.isOwner)fail(403,'Only an organisation owner can propose a consent notice.');return;}
 if(c.type==='consentNoticeReview'){if(!m.isOwner&&m.role!=='admin')fail(403,'An owner or administrator must review consent notices from their own account.');return;}
 if(!care(m))fail(403,'A care role with access to this patient records permission changes.');
 if(typeof c.personId==='string')person(s.workspace,c.personId);
}
export const approvedNotices=(s:OrgState,language?:'en'|'hi')=>{
 const current=new Map<string,ConsentNotice>();
 for(const n of s.operations?.consentNotices??[])if(n.review?.decision==='approved'&&(!language||n.language===language)){
  const key=`${n.purpose}:${n.language}`,existing=current.get(key),number=(x:ConsentNotice)=>Number(x.version.slice(1));
  if(!existing||number(n)>number(existing))current.set(key,n);
 }
 return [...current.values()];
};
export const consentNoticesFor=(s:OrgState,m:Member)=>m.isOwner||m.role==='admin'?(s.operations?.consentNotices??[]):approvedNotices(s,m.language);
export function granted(p:Person,purpose:ConsentPurpose){return purpose==='ai'?p.aiConsent:purpose==='exchange'?p.exchangeConsent:[...(p.contactPreferenceRecords??[]),...(p.contactPreferences?[p.contactPreferences]:[])].some(x=>x.permission);}
const version=(p:Person,purpose:ConsentPurpose)=>purpose==='contact'?Math.max(0,...(p.contactPreferenceRecords??[]).map(x=>x.version),p.contactPreferences?.version??0):p.consentVersion;
export function recordConsent(p:Person,e:Omit<ConsentEvent,'id'>){
 const items=e.items.slice(0,MAX_ITEMS),omitted=e.items.length-items.length;
 const event:ConsentEvent={id:uuid(),...e,items,...(omitted?{omitted}:{})};
 const h=p.consentHistory??=[];h.push(event);if(h.length>MAX_HISTORY)h.splice(0,h.length-MAX_HISTORY);return event;
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
 if(purpose==='contact'){const records=[...(p.contactPreferenceRecords??[])];if(p.contactPreferences&&!records.includes(p.contactPreferences))records.push(p.contactPreferences);for(const c of records){if(!c.permission)continue;c.permission=false;c.version++;c.updatedAt=now;c.by=u.userId;}items.push(...contactWithdrawalItems(s,p,now,'Contact permission withdrawn.'));}
 else {if(purpose==='ai')p.aiConsent=false;else p.exchangeConsent=false;p.consentVersion++;(purpose==='ai'?ai:exchange)(s,p,now,items);}
 return recordConsent(p,{purpose,action:'withdrawn',at:now,by:u.userId,byName:u.displayName,role:m.role,channel,reference,reason,fromVersion:from,toVersion:version(p,purpose),items});
}
export function applyConsent(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 const t=(input as any)?.type;if(!['withdrawConsent','setConsent','consentNoticePropose','consentNoticeReview','recordConsentDecision'].includes(t))return null;
 authorizeConsent(s,m,input);const w=s.workspace;
 if(t==='consentNoticePropose'){
  const parsed=consentSchema.safeParse(input);if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid consent notice.');const c=parsed.data;if(c.type!=='consentNoticePropose')return null;
  if(c.purpose==='ai'&&!c.scopes.includes('ai-assistance'))fail(422,'An AI notice must name AI assistance in its scope.');
  if(c.purpose==='exchange'&&!c.scopes.includes('external-record-sharing'))fail(422,'A sharing notice must name external record sharing in its scope.');
  if(c.purpose==='ai'&&c.scopes.includes('external-record-sharing'))fail(422,'External record sharing requires its own notice and decision.');
  if(c.purpose==='exchange'&&c.scopes.some(x=>x!=='external-record-sharing'))fail(422,'AI assistance and recording require their own notice and decision.');
  const ops=s.operations??={version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null},notices=ops.consentNotices??=[];
  if(notices.length>=100)fail(422,'Consent notice history limit reached.');
  if(notices.some(n=>n.purpose===c.purpose&&n.language===c.language&&n.version===c.version))fail(409,'This notice purpose, language and version already exists.');
  const notice:ConsentNotice={id:uuid(),purpose:c.purpose,language:c.language,version:c.version,title:c.title,body:c.body,scopes:c.scopes,expiryRequired:c.expiryRequired,proposedBy:u.userId,proposedAt:now};notices.push(notice);ops.consentNotices=notices;ops.version++;ops.updatedAt=now;
  w.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:m.role,action:t,subject:notice.id,detail:`Consent notice ${notice.version} proposed for ${notice.purpose}, ${notice.language}; scopes ${notice.scopes.join(', ')}. It cannot be used until a different authorised account reviews it.`});
  return {noticeId:notice.id,status:'review-required'};
 }
 if(t==='consentNoticeReview'){
  const parsed=consentSchema.safeParse(input);if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid consent notice review.');const c=parsed.data;if(c.type!=='consentNoticeReview')return null;
  const ops=s.operations??={version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null},notice=(ops.consentNotices??[]).find(n=>n.id===c.noticeId);if(!notice)fail(404,'Consent notice not found.');if(notice.review)fail(409,'This notice already has a retained review. Propose a new version for changes.');if(notice.proposedBy===u.userId)fail(403,'The notice author cannot review their own notice.');
  notice.review={decision:c.decision,by:u.userId,at:now,reference:c.reference,note:c.note};ops.version++;ops.updatedAt=now;w.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:m.role,action:t,subject:notice.id,detail:`Consent notice ${notice.version} (${notice.language}) review recorded as ${c.decision}; reference ${c.reference}. This application review does not replace formal privacy, language or clinical acceptance.`});return {noticeId:notice.id,status:c.decision};
 }
 let e:ConsentEvent,action=t;
 if(t==='withdrawConsent'){
  const parsed=consentSchema.safeParse(input);if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid permission withdrawal.');const c=parsed.data;if(c.type!=='withdrawConsent')return null;const p=person(w,c.personId);
  if(p.version!==c.version)fail(409,'This patient record has changed. Refresh before recording the withdrawal.');
  if(!granted(p,c.purpose))fail(409,`${PURPOSE_LABEL[c.purpose]} is not currently permitted, so there is nothing to withdraw.`);
  if(c.purpose==='contact'&&!p.contactPreferences&&!(p.contactPreferenceRecords?.length))fail(409,'No contact preferences are recorded for this patient.');
  e=withdraw(s,p,c.purpose,u,m,now,c.channel,c.reference,c.reason);
 } else if(t==='setConsent'){
  const parsed=setConsentSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data,p=person(w,c.personId);
  if(p.version!==c.version)fail(409,'This patient record has changed. Refresh before updating permission.');
  if((p.consentDecisions??[]).some(d=>d.purpose===c.purpose))fail(409,'Use a current reviewed notice to change this scoped permission.');
  if(c.active){const from=p.consentVersion;if(c.purpose==='ai')p.aiConsent=true;else p.exchangeConsent=true;p.consentVersion++;const items:DownstreamItem[]=[];plans(s,p,items);e=recordConsent(p,{purpose:c.purpose,action:'granted',at:now,by:u.userId,byName:u.displayName,role:m.role,channel:'switch',reference:'',reason:'',fromVersion:from,toVersion:p.consentVersion,items});}
  else e=withdraw(s,p,c.purpose,u,m,now,'switch','','Recorded with the permission switch.');
  action='setConsent';
 } else {
  const parsed=consentSchema.safeParse(input);if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid consent decision.');const c=parsed.data;if(c.type!=='recordConsentDecision')return null;const p=person(w,c.personId);
  if(p.version!==c.version)fail(409,'This patient record has changed. Refresh before recording the decision.');
  const notice=(s.operations?.consentNotices??[]).find(n=>n.id===c.noticeId&&n.review?.decision==='approved');if(!notice||!approvedNotices(s,notice.language).some(n=>n.id===notice.id))fail(409,'Use a current independently reviewed notice.');
  if(notice.language!==m.language)fail(409,'Use the current reviewed notice in the patient-facing language for this care interaction.');
  if(c.authority==='self'&&(c.representativePersonId||c.proxyGrantId))fail(422,'A self decision cannot name representative authority.');
  if(c.authority==='representative'){
   if(!c.representativePersonId||!c.proxyGrantId)fail(422,'Choose the authorised representative and current proxy grant.');
   person(w,c.representativePersonId);const grant=(p.proxies??[]).find(g=>g.id===c.proxyGrantId&&g.proxyPersonId===c.representativePersonId&&g.purposes.includes('care-coordination')&&activeGrant(g,now));if(!grant)fail(409,'The representative needs a current care-coordination proxy grant for this person.');
  }
  if(c.decision==='granted'&&notice.expiryRequired&&!c.expiresAt)fail(422,'This notice requires a decision expiry.');
  if(c.expiresAt){const days=(Date.parse(c.expiresAt)-Date.parse(now))/86400000;if(days<=0||days>365)fail(422,'Set a future expiry within 365 days.');}
  const decisions=p.consentDecisions??=[];if(decisions.length>=100)fail(422,'Consent decision history limit reached.');
  const decision:ConsentDecision={id:uuid(),purpose:notice.purpose,noticeId:notice.id,noticeVersion:notice.version,language:notice.language,scopes:[...notice.scopes],decision:c.decision,authority:c.authority,...(c.representativePersonId?{representativePersonId:c.representativePersonId}:{}),...(c.proxyGrantId?{proxyGrantId:c.proxyGrantId}:{}),...(c.expiresAt?{expiresAt:c.expiresAt}:{}),at:now,by:u.userId,channel:c.channel};decisions.push(decision);p.consentDecisions=decisions;
  if(c.decision==='declined')e=withdraw(s,p,notice.purpose,u,m,now,c.channel,`${notice.id}@${notice.version}`,`Optional use declined after notice in ${notice.language}; ordinary care remains available.`);
  else{const from=p.consentVersion;if(notice.purpose==='ai')p.aiConsent=true;else p.exchangeConsent=true;p.consentVersion++;const items:DownstreamItem[]=[];plans(s,p,items);e=recordConsent(p,{purpose:notice.purpose,action:'granted',at:now,by:u.userId,byName:u.displayName,role:m.role,channel:c.channel,reference:`${notice.id}@${notice.version}`,reason:`Scoped ${notice.purpose} decision recorded from reviewed ${notice.language} notice.`,fromVersion:from,toVersion:p.consentVersion,items});}
  action='recordConsentDecision';
 }
 const label=PURPOSE_LABEL[e.purpose];
 w.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:m.role,action,subject:(input as any).personId,personId:(input as any).personId,detail:e.action==='granted'?`${label} permission recorded (version ${e.fromVersion} to ${e.toVersion}).`:`${label} permission withdrawn (version ${e.fromVersion} to ${e.toVersion}${e.channel!=='switch'?`, ${e.channel}, reference ${e.reference}`:''}). ${summary(e.items)} Already shared records are not recalled.`});
 return {eventId:e.id,purpose:e.purpose,action:e.action,version:e.toVersion,items:e.items.length,stopped:e.items.filter(i=>i.disposition==='stopped').length,inFlight:e.items.filter(i=>i.disposition==='in-flight').length,alreadySent:e.items.filter(i=>i.disposition==='already-sent').length};
}
