import {z} from 'zod';
import {normallyAllowed} from './access';
import {fail,uuid} from './core';
import type {Actor} from './store';
import type {Member,OrgState} from './types';

// BR-OPS-05: an ordinary support case carries only fixed diagnostic metadata. Patient
// content stays behind a separately approved, field-limited and expiring grant.
export const SUPPORT_TASKS=['field-sync','visit-save','programme-submission','media-upload'] as const;
export const SUPPORT_FAILURES=['offline-timeout','conflict','storage-unavailable','dependency-unavailable','response-unknown'] as const;
export const SUPPORT_CONTENT_SCOPES=['identity','visit-status','visit-facts'] as const;
export type SupportContentScope=typeof SUPPORT_CONTENT_SCOPES[number];
export type SupportGrant={id:string;supporterId:string;purpose:string;scopes:SupportContentScope[];minutes:number;requestedAt:string;requestedMemberVersion:number;state:'requested'|'approved'|'denied'|'revoked';decidedAt?:string;decidedBy?:string;decidedMemberVersion?:number;approvedPersonVersion?:number;approvedVisitVersion?:number;approvedRecordVersion?:number;decisionNote?:string;expiresAt?:string;revokedAt?:string;revokedBy?:string;revokeReason?:string};
export type SupportCaseEvent={id:string;kind:'opened'|'grant-requested'|'grant-approved'|'grant-denied'|'grant-revoked'|'resolved';at:string;by:string;caseVersion:number;grantId?:string};
export type SupportCase={id:string;personId:string;visitId:string;requesterId:string;task:typeof SUPPORT_TASKS[number];failure:typeof SUPPORT_FAILURES[number];reportedAt:string;reportedMemberVersion:number;visitVersion:number;recordVersion:number;version:number;state:'open'|'resolved';grants:SupportGrant[];events:SupportCaseEvent[];resolvedAt?:string;resolvedBy?:string;resolution?:'configuration-guidance'|'retry-after-recovery'|'duplicate'|'unable-to-reproduce';resolutionNote?:string};

const id=z.string().trim().min(1).max(200),reason=z.string().trim().min(20,'Explain the support purpose in at least 20 characters.').max(500),note=z.string().trim().min(10).max(500),expected=z.number().int().positive();
export const supportCaseSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('supportCaseOpen'),visitId:id,task:z.enum(SUPPORT_TASKS),failure:z.enum(SUPPORT_FAILURES)}).strict(),
 z.object({type:z.literal('supportGrantRequest'),caseId:id,expectedVersion:expected,purpose:reason,scopes:z.array(z.enum(SUPPORT_CONTENT_SCOPES)).min(1).max(SUPPORT_CONTENT_SCOPES.length).refine(x=>new Set(x).size===x.length,'List each support scope once.'),minutes:z.number().int().min(15).max(120)}).strict(),
 z.object({type:z.literal('supportGrantDecision'),caseId:id,expectedVersion:expected,grantId:id,decision:z.enum(['approve','deny']),note}).strict(),
 z.object({type:z.literal('supportGrantRevoke'),caseId:id,expectedVersion:expected,grantId:id,reason:note}).strict(),
 z.object({type:z.literal('supportCaseResolve'),caseId:id,expectedVersion:expected,outcome:z.enum(['configuration-guidance','retry-after-recovery','duplicate','unable-to-reproduce']),note}).strict(),
]);
export type SupportCaseCommand=z.infer<typeof supportCaseSchema>;
const TYPES=new Set(supportCaseSchema.options.map(x=>x.shape.type.value));
export const cases=(s:OrgState)=>s.operations?.supportCases??[];
const findCase=(s:OrgState,id:string)=>{const c=cases(s).find(x=>x.id===id);if(!c)fail(404,'Support case unavailable.');return c;};
const personFor=(s:OrgState,c:SupportCase)=>s.workspace.people.find(x=>x.id===c.personId);
const visitFor=(s:OrgState,c:SupportCase)=>s.workspace.visits.find(x=>x.id===c.visitId&&x.personId===c.personId);
const ownerCanApprove=(m:Member,p:ReturnType<typeof personFor>)=>!!p&&m.isOwner&&m.role!=='admin'&&normallyAllowed(m,p);
const supporter=(m:Member)=>m.status==='active'&&m.role==='admin';

export function authorizeSupportCase(s:OrgState,m:Member,input:any){
 if(!TYPES.has(input?.type))return;
 const c=input as SupportCaseCommand;
 if(c.type==='supportCaseOpen'){
  const v=s.workspace.visits.find(x=>x.id===c.visitId),p=s.workspace.people.find(x=>x.id===v?.personId);
  if(!v||!p||!['asha','clinician'].includes(m.role)||!normallyAllowed(m,p))fail(403,'Current scoped care access is required to open a support case.');
  return;
 }
 const item=findCase(s,c.caseId),p=personFor(s,item);
 if(c.type==='supportGrantDecision'){if(!ownerCanApprove(m,p))fail(403,'A current scoped owner must decide exceptional support access.');}
 else if(c.type==='supportGrantRevoke'){
  const g=item.grants.find(x=>x.id===c.grantId);if(!g||!(g.supporterId===m.userId&&supporter(m)||ownerCanApprove(m,p)))fail(403,'Only the current support agent or a scoped owner may revoke this grant.');
 }
 else if(!supporter(m))fail(403,'A current administrator support role is required.');
}

export function applySupportCase(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):any|null{
 if(!TYPES.has((input as any)?.type))return null;
 const parsed=supportCaseSchema.safeParse(input);if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid support case operation.');const c=parsed.data;
 authorizeSupportCase(s,m,c);
 const ops=s.operations??={version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null},list=ops.supportCases??=[];ops.supportCases=list;
 if(list.length>=1000)fail(422,'Support case retention limit reached; archive under an approved policy before adding another.');
 let item:SupportCase,detail:string,result:any;
 if(c.type==='supportCaseOpen'){
  const v=s.workspace.visits.find(x=>x.id===c.visitId)!,p=s.workspace.people.find(x=>x.id===v.personId)!;
  if(v.voidedAt||v.supersededBy)fail(409,'Choose the current visit where the task failed.');
  item={id:uuid(),personId:p.id,visitId:v.id,requesterId:u.userId,task:c.task,failure:c.failure,reportedAt:now,reportedMemberVersion:m.version,visitVersion:v.version,recordVersion:v.recordVersion,version:1,state:'open',grants:[],events:[]};
  item.events.push({id:uuid(),kind:'opened',at:now,by:u.userId,caseVersion:1});list.push(item);
  detail=`Support case ${item.id} opened from failed ${c.task}; fixed diagnostic ${c.failure}; visit version ${v.version}/${v.recordVersion}. Patient content is absent from the routine support view.`;result={caseId:item.id,version:item.version};
 } else {
  item=findCase(s,c.caseId);if(item.version!==c.expectedVersion)fail(409,'Support case changed. Refresh before continuing.');if(item.state==='resolved'&&c.type!=='supportGrantRevoke')fail(409,'This support case is resolved.');
  if(c.type==='supportGrantRequest'){
   if(item.grants.some(g=>g.supporterId===u.userId&&['requested','approved'].includes(g.state)&&(!g.expiresAt||g.expiresAt>now)))fail(409,'You already have a pending or active grant for this case.');
   if(item.grants.length>=20)fail(422,'Support access history limit reached for this case.');
   const g:SupportGrant={id:uuid(),supporterId:u.userId,purpose:c.purpose,scopes:[...c.scopes],minutes:c.minutes,requestedAt:now,requestedMemberVersion:m.version,state:'requested'};item.grants.push(g);item.version++;item.events.push({id:uuid(),kind:'grant-requested',at:now,by:u.userId,caseVersion:item.version,grantId:g.id});detail=`Exceptional support grant ${g.id} requested for case ${item.id}; scopes ${g.scopes.join(', ')}; ${g.minutes} minutes. Purpose: ${g.purpose}`;result={caseId:item.id,grantId:g.id,version:item.version};
  } else if(c.type==='supportGrantDecision'){
   const g=item.grants.find(x=>x.id===c.grantId);if(!g)fail(404,'Support grant unavailable.');if(g.state!=='requested')fail(409,'This support grant is no longer awaiting a decision.');if(g.supporterId===u.userId)fail(403,'A different scoped owner must decide support access.');
   g.state=c.decision==='approve'?'approved':'denied';g.decidedAt=now;g.decidedBy=u.userId;g.decidedMemberVersion=m.version;g.decisionNote=c.note;if(g.state==='approved'){const p=personFor(s,item),v=visitFor(s,item);if(!p||!v)fail(409,'The support case record changed before approval.');g.approvedPersonVersion=p.version;g.approvedVisitVersion=v.version;g.approvedRecordVersion=v.recordVersion;g.expiresAt=new Date(Date.parse(now)+g.minutes*60000).toISOString();}item.version++;item.events.push({id:uuid(),kind:g.state==='approved'?'grant-approved':'grant-denied',at:now,by:u.userId,caseVersion:item.version,grantId:g.id});detail=`Exceptional support grant ${g.id} ${g.state}; scopes ${g.scopes.join(', ')}; expiry ${g.expiresAt??'none'}. Decision note: ${c.note}`;result={caseId:item.id,grantId:g.id,state:g.state,expiresAt:g.expiresAt??null,version:item.version};
  } else if(c.type==='supportGrantRevoke'){
   const g=item.grants.find(x=>x.id===c.grantId);if(!g)fail(404,'Support grant unavailable.');if(g.state!=='approved'||g.revokedAt||!g.expiresAt||g.expiresAt<=now)fail(409,'This support grant is not active.');g.state='revoked';g.revokedAt=now;g.revokedBy=u.userId;g.revokeReason=c.reason;item.version++;item.events.push({id:uuid(),kind:'grant-revoked',at:now,by:u.userId,caseVersion:item.version,grantId:g.id});detail=`Exceptional support grant ${g.id} revoked. Reason: ${c.reason}`;result={caseId:item.id,grantId:g.id,version:item.version};
  } else {
   item.state='resolved';item.resolvedAt=now;item.resolvedBy=u.userId;item.resolution=c.outcome;item.resolutionNote=c.note;item.version++;for(const g of item.grants)if(g.state==='approved'&&g.expiresAt&&g.expiresAt>now){g.state='revoked';g.revokedAt=now;g.revokedBy=u.userId;g.revokeReason='Support case resolved.';}item.events.push({id:uuid(),kind:'resolved',at:now,by:u.userId,caseVersion:item.version});detail=`Support case ${item.id} resolved as ${c.outcome}; active exceptional access revoked. Note: ${c.note}`;result={caseId:item.id,state:item.state,version:item.version};
  }
 }
 ops.version++;ops.updatedAt=now;
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:item.id,personId:item.personId,detail});
 return result;
}

const grantCurrent=(s:OrgState,item:SupportCase,g:SupportGrant,now:string)=>{const p=personFor(s,item),v=visitFor(s,item),decider=s.members.find(x=>x.userId===g.decidedBy);return g.state==='approved'&&!g.revokedAt&&!!g.expiresAt&&g.expiresAt>now&&!!p&&!!v&&!!decider&&g.decidedMemberVersion===decider.version&&ownerCanApprove(decider,p)&&g.approvedPersonVersion===p.version&&g.approvedVisitVersion===v.version&&g.approvedRecordVersion===v.recordVersion;};
export function redactedCase(s:OrgState,item:SupportCase,viewer:Member,now=new Date().toISOString()){
 const own=item.requesterId===viewer.userId,owner=viewer.isOwner&&viewer.role!=='admin';
 return {id:item.id,task:item.task,failure:item.failure,reportedAt:item.reportedAt,version:item.version,state:item.state,...(own||owner?{visitId:item.visitId}:{}),grants:item.grants.filter(g=>owner||g.supporterId===viewer.userId).map(g=>({id:g.id,purpose:g.purpose,scopes:g.scopes,minutes:g.minutes,state:g.state,requestedAt:g.requestedAt,expiresAt:g.expiresAt??null,active:grantCurrent(s,item,g,now)})),events:item.events.map(e=>({kind:e.kind,at:e.at,caseVersion:e.caseVersion,...(owner?{by:e.by}:{}),...(e.grantId?{grantId:e.grantId}:{})})),...(item.state==='resolved'?{resolution:item.resolution,resolvedAt:item.resolvedAt}:{}),diagnostics:{release:'11 / v1.3-readiness',visitVersion:item.visitVersion,recordVersion:item.recordVersion,memberVersion:item.reportedMemberVersion,containsPatientContent:false}};
}

export function activeSupportGrant(s:OrgState,item:SupportCase,m:Member,now=new Date().toISOString()){
 if(!supporter(m))return undefined;
 return item.grants.find(g=>g.supporterId===m.userId&&g.requestedMemberVersion===m.version&&grantCurrent(s,item,g,now));
}
