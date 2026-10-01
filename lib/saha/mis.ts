import { z } from 'zod';
import { digest, fail, person, uuid, visit } from './core';
import { PROGRAMMES, type Integration, type Member, type OrgState, type Submission, type TraceRef, type Visit } from './types';
import type { Actor } from './store';
export const MIS_FIELDS=['personId','visitId','date','source','systolic','diastolic','weight','temperature','weeks','coughDays','notes'] as const;
export type Mapping={source:typeof MIS_FIELDS[number];target:string;required:boolean};
export type MisConfig={contract:'saha-mis-v1';mapping:Mapping[];corrections:boolean;test?:{at:string;version:number;ok:boolean;message:string}};
export type Delivery={endpoint:string;credentialBinding:string;key:string;actorId:string;connectorVersion:number;personVersion:number;consentVersion:number;visitVersion:number;expiresAt:string;payload:Record<string,unknown>;startedAt?:string;operationId?:string;events:{at:string;state:string;detail:string;attempt?:number;ref?:TraceRef}[]};
const id=z.string().min(1).max(200),ver=z.number().int().positive();
export const mappingSchema=z.array(z.object({source:z.enum(MIS_FIELDS),target:z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,63}$/).refine(s=>!['constructor','prototype','__proto__'].includes(s),'Reserved destination field'),required:z.boolean()}).strict()).min(1).max(20).refine(rows=>new Set(rows.map(r=>r.target)).size===rows.length,'Destination fields must be unique');
export const misSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('configureMis'),integrationId:id,version:ver,programmes:z.array(z.enum(PROGRAMMES as [string,...string[]])).min(1).max(5),mapping:mappingSchema,corrections:z.boolean()}).strict(),
 z.object({type:z.literal('testMis'),integrationId:id,version:ver}).strict(),
 z.object({type:z.literal('activateMis'),integrationId:id,version:ver}).strict(),
 z.object({type:z.literal('sendSubmission'),submissionId:id}).strict(),
 z.object({type:z.literal('lookupSubmission'),submissionId:id}).strict(),
 z.object({type:z.literal('cancelSubmission'),submissionId:id}).strict(),
]);
export type MisCommand=z.infer<typeof misSchema>;
export function misAudit(s:OrgState,u:Actor,m:Member,action:string,subject:string,detail:string,personId?:string){s.workspace.audit.push({id:uuid(),at:new Date().toISOString(),actor:u.displayName,actorId:u.userId,role:m.role,action,subject,detail,personId});}
export function misIntegration(s:OrgState,id:string){const i=s.workspace.integrations.find(i=>i.id===id);if(!i||i.kind!=='mis'||i.mode!=='http')fail(422,'Choose an HTTP programme connection.');return i;}
export function misCredential(i:Integration,orgId:string,env:Record<string,string|undefined>,callback=false){
 if(env.SAHA_EXTERNAL_APIS_ENABLED!=='true')fail(409,'External programme services are disabled.');
 if(!i.endpoint||!i.credentialBinding||!/^SAHA_MIS_[A-Z0-9_]+$/.test(i.credentialBinding))fail(409,'Use a dedicated SAHA_MIS_ server secret binding.');
 const url=new URL(i.endpoint);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.hostname==='localhost'||/^[\d.]+$/.test(url.hostname)||url.hostname.includes(':')||url.hostname.endsWith('.local'))fail(403,'Choose an approved public HTTPS programme origin.');
 let grants:any[]=[];try{grants=JSON.parse(env.SAHA_MIS_CONNECTIONS??'[]');}catch{fail(409,'Server programme grants are invalid.');}
 if(!Array.isArray(grants))fail(409,'Server programme grants are invalid.');
 const grant=grants.find(g=>g.organisationId===orgId&&g.integrationId===i.id&&g.origin===url.origin&&g.credentialBinding===i.credentialBinding);
 if(!grant)fail(403,'This organisation and connection have no server-approved programme grant.');
 const binding=callback?grant.callbackBinding:i.credentialBinding;if(typeof binding!=='string'||!/^SAHA_MIS_[A-Z0-9_]+$/.test(binding)||!env[binding])fail(409,'The dedicated programme credential is not configured.');return env[binding]!;
}
export function misReadiness(i:Integration,orgId:string,env:Record<string,string|undefined>){try{misCredential(i,orgId,env);return {id:i.id,ready:true,message:'Server grant and credential configured.'};}catch(e){return {id:i.id,ready:false,message:e instanceof Error?e.message:'Connection unavailable.'};}}
export function mappedPayload(i:Integration,v:Visit,s:OrgState){
 if(!i.mis)fail(409,'Configure and test the programme mapping first.');const fields:Record<string,string>={};
 for(const map of i.mis.mapping){const value=map.source==='personId'?v.personId:map.source==='visitId'?v.id:v.facts[map.source];if(!value&&map.required)fail(422,`${i.name}: required field ${map.target} is missing.`);if(value)fields[map.target]=value;}
 let prior:Submission|undefined,ancestor=v.amendsVisitId;const seen=new Set<string>();
 while(ancestor){if(seen.has(ancestor))fail(409,'Correction history is inconsistent.');seen.add(ancestor);const deliveries=s.workspace.submissions.filter(x=>x.visitId===ancestor&&x.connectorId===i.id);if(deliveries.some(x=>['sending','uncertain','queued','retryable'].includes(x.state)))fail(409,'Resolve the original submission before sending its correction.');prior=deliveries.find(x=>x.state==='accepted');if(prior)break;ancestor=s.workspace.visits.find(x=>x.id===ancestor)?.amendsVisitId;}
 if(prior&&!i.mis.corrections)fail(409,'This destination has not enabled correction support.');
 return {contract:'saha-mis-v1',environment:'synthetic',operation:prior?'correct':'submit',fields,...(prior?{replaces:{submissionKey:prior.delivery?.key,receipt:prior.receipt}}:{})};
}
export function deliveryEvent(s:Submission,detail:string){s.updatedAt=new Date().toISOString();s.message=detail;s.delivery?.events.push({at:s.updatedAt,state:s.state,detail});}
export async function configureMis(s:OrgState,c:MisCommand,u:Actor,m:Member,env:Record<string,string|undefined>){
 if(c.type==='cancelSubmission'){const sub=s.workspace.submissions.find(x=>x.id===c.submissionId);if(!sub?.delivery)fail(404,'Programme delivery not found.');person(s.workspace,sub.personId);if(!['asha','clinician'].includes(m.role))fail(403,'A care role is required.');if(!['queued','retryable'].includes(sub.state))fail(409,'Only a confirmed unsent delivery can be cancelled. Look up uncertain receipts first.');sub.state='cancelled';deliveryEvent(sub,'Unsent delivery cancelled. No record was recalled.');misAudit(s,u,m,c.type,sub.id,sub.message,sub.personId);return {ok:true};}
 if(!['configureMis','activateMis'].includes(c.type))return null;
 if(!m.isOwner)fail(403,'Only an organisation owner can configure programme delivery.');
 if(!('integrationId' in c))return null;const i=misIntegration(s,c.integrationId);if(i.version!==c.version)fail(409,'Connection changed. Refresh first.');
 if(c.type==='configureMis'){i.mis={contract:'saha-mis-v1',mapping:c.mapping,corrections:c.corrections};i.programmes=c.programmes as any;i.status='suspended';i.version++;}
 else if(c.type==='activateMis'){misCredential(i,s.organisation.id,env);if(!i.mis?.test?.ok||i.mis.test.version!==i.version||Date.parse(i.mis.test.at)<Date.now()-86400000)fail(409,'Pass a connection test for this version within 24 hours before activation.');i.status='active';i.version++;i.mis.test.version=i.version;}
 misAudit(s,u,m,c.type,i.id,c.type==='configureMis'?'Programme mapping saved; connection suspended and older approvals invalidated.':'Tested programme connection activated.');return {ok:true};
}
export function deliveryCurrent(s:OrgState,sub:Submission,u:Actor,m:Member,env:Record<string,string|undefined>){
 if(!['asha','clinician'].includes(m.role))fail(403,'A care role is required to send records.');const p=person(s.workspace,sub.personId),v=visit(s.workspace,sub.visitId),d=sub.delivery!;
 if(!p.exchangeConsent||p.consentVersion!==d.consentVersion||p.version!==d.personVersion||v.version!==d.visitVersion||v.state!=='confirmed'||v.voidedAt||v.supersededBy)fail(409,'Record or sharing permission changed. Cancel this unsent delivery and review a fresh plan.');
 if(d.actorId!==u.userId||d.expiresAt<new Date().toISOString())fail(409,'The original approving worker must send within the approval window. Cancel unsent delivery and prepare a fresh plan.');
 const i=misIntegration(s,sub.connectorId);if(i.status!=='active'||i.version!==d.connectorVersion)fail(409,'Connection changed. Review a fresh plan.');misCredential(i,s.organisation.id,env);return i;
}
export const receiptSchema=z.object({contract:z.literal('saha-mis-v1'),key:id,payloadHash:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['accepted','rejected','pending','not_found']),receipt:z.string().min(1).max(200).optional()}).strict();
export function applyReceipt(sub:Submission,raw:unknown,lookup=false){const p=receiptSchema.safeParse(raw);if(!p.success)fail(502,'Programme response did not match the receipt contract.');const r=p.data;if(r.key!==sub.delivery?.key||r.payloadHash!==sub.payloadHash)fail(502,'Programme receipt did not match this delivery.');if(r.status==='accepted'&&!r.receipt)fail(502,'Accepted responses require a destination receipt.');if(r.status==='not_found'&&!lookup)fail(502,'Only a receipt lookup can confirm that a record was not found.');
 if(['accepted','rejected'].includes(sub.state)){if(sub.state!==r.status||(r.status==='accepted'&&sub.receipt!==r.receipt))fail(409,'A conflicting terminal receipt requires partner investigation.');return;}
 if(sub.state==='cancelled'||!sub.attempts)fail(409,'This submission has not been sent.');
 sub.state=r.status==='accepted'?'accepted':r.status==='rejected'?'rejected':r.status==='not_found'?'retryable':'uncertain';if(r.receipt)sub.receipt=r.receipt;deliveryEvent(sub,r.status==='accepted'?'Programme confirmed acceptance.':r.status==='rejected'?'Programme rejected this payload. Correct the visit and review a new plan.':r.status==='not_found'?'Programme confirmed no record for this key. A retry reuses the same payload and key.':'Programme is still processing. Look up the receipt; do not resend.');
}
export async function misRequest(i:Integration,orgId:string,env:Record<string,string|undefined>,body:unknown,key:string,send:typeof fetch=fetch){
 const secret=misCredential(i,orgId,env);const timeout=AbortSignal.timeout(15000);
 const response=await send(i.endpoint!,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${secret}`,'Idempotency-Key':key},body:JSON.stringify(body),redirect:'error',signal:timeout});
 if(!response.ok)fail(502,`Programme returned HTTP ${response.status}. Receipt is unconfirmed.`);
 const reader=response.body?.getReader();if(!reader)fail(502,'Empty programme response.');let size=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>16000){await reader.cancel();fail(502,'Programme response exceeded its size limit.');}chunks.push(value);}
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}try{return JSON.parse(new TextDecoder().decode(bytes));}catch{fail(502,'Programme returned invalid JSON.');}
}
