import { z } from 'zod';
import { AppError, fail, uuid } from './core';
import { canonicalSpec, indicatorRun, manager, MIN_CELL, resolveDefinition, type Series } from './indicators';
import { aggregateFieldsOf, operationRefusal, operationsOf, refusalOf, type Refusal } from './adapter-operations';
import type { Actor } from './store';
import type { Integration, Member, OrgState, TraceRef } from './types';
// Slice 7g: aggregate report delivery to aggregate-only programme destinations (BR-INT-09, BR-REP-05).
//
// An owner, or a supervisor for their own teams, prepares a report for one aggregate-only destination from named
// indicator definitions and versions, a period and teams in their reporting scope. The payload holds only the
// suppressed aggregate cells the indicator page would show (slice 6d/6s suppression), withheld blocks named as
// withheld, a definition and version manifest, the row count and a SHA-256 of the content. A different authorised
// person approves it; the preparer or the approver sends it within the approval window.
//
// Before anything is sent the payload passes a minimisation check (no patient-level field, no value that is a
// patient identifier, name, ABHA number or external identifier, no released cell from 1 to 4), recorded on the
// report each time it runs. Sending follows the external-execution rules of the programme outbox (slice 3c/7e):
// the aggregate operation is checked before preparing and again inside the checkpoint, the request is recorded in
// the audit chain before it is sent (slice 6t), each step is linked to its command (slice 6y), the report id is
// the idempotency key, an unresolved outcome is looked up and never resent, and nothing is retried automatically.
// This module has the pure parts; aggregate-execution.ts has the steps that read and write storage.
export const AGGREGATE_CONTRACT='saha-aggregate-v1';
export const APPROVAL_HOURS=24;
// Slice 6ad (ninth review, finding 4): the limit counts open reports only (prepared, approved, sending, uncertain);
// a report not approved within the approval window, or approved and not sent within it, is closed as expired.
export const REPORT_LIMIT=20;
// Slice 6ad (finding 3): reports live in the operations row beside the differencing ledger (at most 1 MB). A report's
// payload is kept only while it is open and must fit PAYLOAD_BYTES; a closed report keeps its manifest, hash, steps
// and receipt (its payload is recomputable from the pinned parameters). All reports together must fit REPORTS_BYTES,
// so the operations row stays well inside D1's 2 MB value limit whatever reports are prepared.
export const PAYLOAD_BYTES=150_000;
export const REPORTS_BYTES=450_000;
export const OPEN_STATES=['prepared','approved','sending','uncertain'];
export const bytesOf=(x:unknown)=>new TextEncoder().encode(JSON.stringify(x)).length;
// Closes expired open reports and removes the payload from closed ones. Returns the reports it closed.
export function compactReports(s:OrgState,now:string,expire=true){
 const closed:AggregateReport[]=[],t=Date.parse(now),window=APPROVAL_HOURS*3600000;
 for(const r of reportsOf(s)){
  if(!expire){}
  else if(r.state==='prepared'&&Date.parse(r.preparedAt)+window<t){r.state='cancelled';reportEvent(r,now,`Expired: not approved within ${APPROVAL_HOURS} hours of preparation. Nothing was sent; prepare a new report if it is still needed.`);closed.push(r);}
  else if(r.state==='approved'&&(!r.expiresAt||r.expiresAt<now)){r.state='cancelled';reportEvent(r,now,`Expired: not sent within ${APPROVAL_HOURS} hours of approval. Nothing was sent; prepare a new report if it is still needed.`);closed.push(r);}
  if(!OPEN_STATES.includes(r.state)&&(r as any).payload)delete (r as any).payload;
 }
 return closed;
}
// Slice 6ad (finding 1): what a report read returns. Cells are never returned to a person: they were screened against
// the destination's releases only, not against what the viewer has been shown. A reader sees the manifest, which
// blocks were withheld and the steps; the figures go to the destination only.
export function reportView(r:AggregateReport){
 const {payload,...rest}=r as AggregateReport&{payload?:AggregatePayload};
 return {...rest,manifest:payload?{definitions:payload.manifest.definitions,rows:payload.manifest.rows,sha256:payload.manifest.sha256}:null,
  blocks:payload?payload.blocks.map(b=>({team:b.team,indicator:b.indicator,version:b.version,unit:b.unit,withheld:b.withheld})):null};
}
export const AGGREGATE_GROUPS=['none','village','programme','age-band'] as const;
export type AggregateGroup=typeof AGGREGATE_GROUPS[number];
export type MinimisationCheck={at:string;stage:'prepare'|'before-send'|'checkpoint';passed:boolean;fields:number;cells:number;problems:string[];destinationAllowlistVersion?:number;destinationAllowlistExplicit?:boolean};
export type ReportEvent={at:string;state:string;detail:string;ref?:TraceRef;attempt?:number};
export type Cell={group:string;value:number|null;numerator:number|null;denominator:number|null;suppressed:boolean};
export type Block={team:string;indicator:string;version:number;unit:'count'|'proportion';withheld:'cohort'|'differencing'|null;cells:Cell[]};
export type AggregatePayload={contract:typeof AGGREGATE_CONTRACT;environment:'synthetic';operation:'aggregate';report:{id:string;period:{start:string;end:string};group:AggregateGroup;minimumCell:number;computedAt:string};manifest:{definitions:{id:string;version:number;canonicalSha256:string}[];rows:number;sha256:string};blocks:Block[]};
export type AggregateReport={id:string;destinationId:string;destinationName:string;definitions:string[];period:{start:string;end:string};teamIds:string[];group:AggregateGroup;computedAt:string;
 state:'prepared'|'approved'|'sending'|'accepted'|'rejected'|'uncertain'|'cancelled';preparedBy:string;preparedByName:string;preparedAt:string;approvedBy?:string;approvedByName?:string;approvedAt?:string;expiresAt?:string;
 payload?:AggregatePayload;payloadSha256:string;rowCount:number;attempts:number;receipt?:string;minimisation:MinimisationCheck[];refusal?:Refusal&{reason?:string};events:ReportEvent[];message:string;updatedAt:string;operationId?:string;startedAt?:string};

const id=z.string().min(1).max(200),day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/,'Use a date as YYYY-MM-DD.');
export const aggregateSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('prepareAggregateReport'),destinationId:id,definitions:z.array(z.string().regex(/^[a-z][a-z0-9-]{1,39}(@\d{1,4})?$/)).min(1).max(8).refine(x=>new Set(x).size===x.length,'Name each indicator once.'),period:z.object({start:day,end:day}).strict(),teamIds:z.array(id).min(1).max(10).refine(x=>new Set(x).size===x.length,'Name each team once.'),group:z.enum(AGGREGATE_GROUPS)}).strict(),
 z.object({type:z.literal('approveAggregateReport'),reportId:id,payloadSha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),
 z.object({type:z.literal('sendAggregateReport'),reportId:id}).strict(),
 z.object({type:z.literal('lookupAggregateReport'),reportId:id}).strict(),
]);
export type AggregateCommand=z.infer<typeof aggregateSchema>;
export const AGGREGATE_TYPES=new Set(['prepareAggregateReport','approveAggregateReport','sendAggregateReport','lookupAggregateReport']);
export const reportsOf=(s:OrgState):AggregateReport[]=>((s.operations as any)?.aggregateReports??[]) as AggregateReport[];
export const reportList=(s:OrgState):AggregateReport[]=>{const ops=(s.operations??={version:0,maintenance:false,reason:'',updatedAt:'',incidents:[],rates:null}) as any;return (ops.aggregateReports??=[]);};
export function findReport(s:OrgState,reportId:string){const r=reportsOf(s).find(x=>x.id===reportId);if(!r)fail(404,'Aggregate report not found.');return r!;}
// Who may act on a report: an active owner or supervisor (not an administrator or ASHA, as for indicators) whose own
// teams include every team in it. Owner authority does not widen the teams: owners report on their own teams too.
export function reportingScope(m:Member,teamIds:string[]){manager(m);if(teamIds.some(t=>!m.teamIds.includes(t)))fail(403,'Choose teams in your own reporting scope.');}
// Checked on first run and again when a saved command is replayed.
export function authorizeAggregate(s:OrgState,m:Member,c:{type:string}){
 if(!AGGREGATE_TYPES.has(c.type))return;const x=c as any;
 if(c.type==='prepareAggregateReport'){reportingScope(m,Array.isArray(x.teamIds)?x.teamIds:[]);return;}
 const r=reportsOf(s).find(y=>y.id===x.reportId);if(r)reportingScope(m,r.teamIds);else manager(m);
}
export function aggregateDestination(s:OrgState,destinationId:string):Integration{
 const i=s.workspace.integrations.find(x=>x.id===destinationId);if(!i||i.kind!=='mis')fail(422,'Choose a programme destination.');
 if(!operationsOf(i!).aggregateOnly)fail(422,`${i!.name} is not an aggregate-only destination. Aggregate reports go to aggregate-only destinations; patient-level records follow the visit plan.`);
 if(i!.mode!=='demo')fail(409,'Aggregate delivery to an HTTP destination needs an aggregate contract agreed with the partner. This release delivers aggregate reports to demonstration destinations only.');
 if(i!.status!=='active')fail(409,`${i!.name} is not active.`);
 return i!;
}
export function aggregateRefusal(i:Integration,stage:Refusal['stage'],now:string):{text:string;refusal:Refusal}|null{
 const text=!operationsOf(i).aggregateOnly?`${i.name} is no longer an aggregate-only destination.`:operationRefusal(i,'aggregate','aggregate');
 return text?{text,refusal:refusalOf(i,'aggregate',stage,now)}:null;
}
// The period: whole UTC days, ending no later than today, at most 366 days. Indicators are computed for the window
// ending at the end of the period (or now, for a period ending today).
export function periodWindow(period:{start:string;end:string},now=new Date()){
 const s=Date.parse(period.start+'T00:00:00Z'),e=Date.parse(period.end+'T00:00:00Z'),today=now.toISOString().slice(0,10);
 if(!Number.isFinite(s)||!Number.isFinite(e)||new Date(s).toISOString().slice(0,10)!==period.start||new Date(e).toISOString().slice(0,10)!==period.end)fail(422,'Use real dates for the period.');
 if(e<s)fail(422,'The period must end on or after its start.');if(period.end>today)fail(422,'The period cannot end after today.');
 const days=Math.round((e-s)/86400000)+1;if(days>366)fail(422,'Choose a period of at most 366 days.');
 return {days,until:period.end===today?now:new Date(e+86400000-1),past:period.end!==today};
}
export async function sha256Hex(text:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
// Canonical JSON (sorted keys) so the SHA-256 is stable whatever order the fields were built in.
export const canonical=(v:unknown):string=>Array.isArray(v)?`[${v.map(canonical).join(',')}]`:v&&typeof v==='object'?`{${Object.keys(v as object).sort().map(k=>`${JSON.stringify(k)}:${canonical((v as any)[k])}`).join(',')}}`:JSON.stringify(v);
export type TeamRun={teamId:string;teamName:string;series:Series[];results:any[]|null};
// Runs each named definition for each team (one indicator query per team, filtered to that team). A team below
// the minimum cohort is withheld whole, as the indicator page refuses it.
export function computeRuns(s:OrgState,m:Member,r:{definitions:string[];teamIds:string[];group:AggregateGroup;period:{start:string;end:string}},now:Date):TeamRun[]{
 const w=periodWindow(r.period,now);
 return r.teamIds.map(teamId=>{const teamName=s.teams.find(t=>t.id===teamId)?.name;if(!teamName)fail(422,'Choose teams that exist.');
  try{const {result,series}=indicatorRun(s,m,{ids:r.definitions,days:w.days,group:r.group,team:teamId},w.until);
   // Slice 6ad (ninth review, finding 2): a period that ended before the report was computed records its end, so it
   // never replaces or escapes a release for the same start that ended at another time.
   if(w.past)for(const sr of series)if(sr.n)sr.u=w.until.toISOString();
   return {teamId,teamName:teamName!,series,results:result.results};}
  catch(e){if(e instanceof AppError&&e.status===422&&/fewer than/.test(e.message))return {teamId,teamName:teamName!,series:[],results:null};throw e;}});
}
// The payload from computed runs and the ids (`id@version` per team) the differencing screen released.
export async function buildPayload(s:OrgState,reportId:string,r:{definitions:string[];group:AggregateGroup;period:{start:string;end:string}},runs:TeamRun[],released:Map<string,Set<string>>,computedAt:string):Promise<AggregatePayload>{
 const defs=r.definitions.map(ref=>resolveDefinition(s,ref));
 const blocks:Block[]=[];
 for(const run of runs)for(const d of defs){
  const res=run.results?.find((x:any)=>x.id===d.id&&x.version===d.version),ok=released.get(run.teamId)?.has(d.id+'@'+d.version);
  const withheld:Block['withheld']=!run.results?'cohort':res?.refused==='cohort'?'cohort':!ok?'differencing':null;
  blocks.push({team:run.teamName,indicator:d.id,version:d.version,unit:d.spec.unit,withheld,cells:withheld?[]:(res.rows as any[]).map(c=>({group:c.group,value:c.suppressed?null:c.value,numerator:c.suppressed?null:c.numerator,denominator:c.suppressed?null:c.denominator,suppressed:!!c.suppressed}))});
 }
 const definitions=await Promise.all(defs.map(async d=>({id:d.id,version:d.version,canonicalSha256:await sha256Hex(canonicalSpec(d))})));
 const report={id:reportId,period:r.period,group:r.group,minimumCell:MIN_CELL,computedAt};
 const rows=blocks.reduce((n,b)=>n+b.cells.length,0),sha256=await sha256Hex(canonical({report,definitions,blocks}));
 return {contract:AGGREGATE_CONTRACT,environment:'synthetic',operation:'aggregate',report,manifest:{definitions,rows,sha256},blocks};
}
const aggregateEnvelopeSchema=z.object({contract:z.literal(AGGREGATE_CONTRACT),environment:z.literal('synthetic'),operation:z.literal('aggregate'),report:z.object({id,period:z.object({start:day,end:day}).strict(),group:z.enum(AGGREGATE_GROUPS),minimumCell:z.literal(MIN_CELL),computedAt:z.string()}).strict(),manifest:z.object({definitions:z.array(z.object({id,version:z.number().int().positive(),canonicalSha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict()).max(8),rows:z.number().int().nonnegative(),sha256:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),blocks:z.array(z.object({team:id,indicator:id,version:z.number().int().positive(),unit:z.enum(['count','proportion']),withheld:z.enum(['cohort','differencing']).nullable(),cells:z.array(z.object({group:z.string().max(200),value:z.number().finite().nullable(),numerator:z.number().finite().nullable(),denominator:z.number().finite().nullable(),suppressed:z.boolean()}).strict()).max(5000)}).strict()).max(80)}).strict();
export async function assertAggregateEnvelope(body:any,key:string){
 if(body?.operation==='lookup'){if(!z.object({contract:z.literal(AGGREGATE_CONTRACT),operation:z.literal('lookup'),key:id,payloadHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict().safeParse(body).success)fail(409,'Aggregate receipt lookup differs from its metadata-only contract.');return;}
 if(bytesOf(body)>PAYLOAD_BYTES||!aggregateEnvelopeSchema.safeParse(body).success||body.report.id!==key)fail(409,'Aggregate envelope differs from its approved contract; review and prepare a fresh report.');
 if(!minimisationCheck(body,{workspace:{people:[],visits:[]}} as unknown as OrgState,'checkpoint',new Date().toISOString()).passed)fail(409,'Aggregate cells differ from the suppression contract; nothing was sent.');if(body.manifest.rows!==body.blocks.reduce((n:number,b:any)=>n+b.cells.length,0)||await sha256Hex(canonical({report:body.report,definitions:body.manifest.definitions,blocks:body.blocks}))!==body.manifest.sha256)fail(409,'Aggregate envelope differs from its approved digest; nothing was sent.');
}
// ---- payload minimisation (BR-INT-09) ----
const ALLOWED_KEYS=new Set(['contract','environment','operation','report','id','period','start','end','group','minimumCell','computedAt','manifest','definitions','version','canonicalSha256','rows','sha256','blocks','team','indicator','unit','withheld','cells','value','numerator','denominator','suppressed']);
export const PATIENT_FIELDS=['personId','patientId','visitId','name','fullName','abha','abhaNumber','abhaAddress','phone','mobile','address','dob','dateOfBirth','age','sex','facts','notes','identifier','identifiers','externalId','consent','visits','people'];
const small=(x:unknown)=>typeof x==='number'&&x>0&&x<MIN_CELL;
// Refuses a payload carrying any patient-level field or identifier value, or any released cell from 1 to 4.
export function minimisationCheck(payload:unknown,s:OrgState,stage:MinimisationCheck['stage'],at:string):MinimisationCheck{
 const normalize=(x:string)=>x.normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').replace(/\s+/g,' ').trim().toLowerCase();const problems:string[]=[],ids=new Set<string>();let fields=0,cells=0;
 for(const p of s.workspace.people??[]){for(const v of [p.id,p.name,p.abha?.number,p.abha?.address,...(p.identifiers??[]).map(x=>x.value)])if(typeof v==='string'&&v.trim().length>=3)ids.add(normalize(v));}
 for(const v of s.workspace.visits??[])ids.add(normalize(v.id));
 const walk=(x:unknown,path:string,depth=0)=>{if(depth>20){problems.push('Aggregate nesting exceeds the mapped contract.');return;}
  if(Array.isArray(x)){x.forEach((y,i)=>walk(y,`${path}[${i}]`,depth+1));return;}
  if(x&&typeof x==='object'){for(const [k,v] of Object.entries(x)){fields++;if(PATIENT_FIELDS.includes(k))problems.push(`Patient-level field "${k}" is not permitted.`);else if(!ALLOWED_KEYS.has(k))problems.push('An unexpected field is not part of the aggregate contract.');walk(v,path?`${path}.${k}`:k,depth+1);}return;}
  if(typeof x==='string'&&ids.has(normalize(x)))problems.push('A value matches a patient identifier, name or ABHA number.');
export function minimisationCheck(payload:unknown,s:OrgState,stage:MinimisationCheck['stage'],at:string,destination?:Integration):MinimisationCheck{
 const problems:string[]=[],ids=new Set<string>();let fields=0,cells=0;
 const destinationFields=destination?aggregateFieldsOf(destination):null,destinationAllowed=destinationFields?new Set(destinationFields.fields):null;
 for(const p of s.workspace.people??[]){for(const v of [p.id,p.name,p.abha?.number,p.abha?.address,...(p.identifiers??[]).map(x=>x.value)])if(typeof v==='string'&&v.trim().length>=3)ids.add(v.trim().toLowerCase());}
 for(const v of s.workspace.visits??[])ids.add(v.id.toLowerCase());
 const walk=(x:unknown,path:string)=>{
  if(Array.isArray(x)){x.forEach((y,i)=>walk(y,`${path}[${i}]`));return;}
  if(x&&typeof x==='object'){for(const [k,v] of Object.entries(x)){fields++;if(PATIENT_FIELDS.includes(k))problems.push(`Patient-level field "${k}" at ${path||'top level'}.`);else if(!ALLOWED_KEYS.has(k))problems.push(`Field "${k}" is not part of the aggregate contract.`);else if(destinationAllowed&&!destinationAllowed.has(k as any))problems.push(`Field "${k}" is not authorised by ${destination!.name}'s destination allowlist (version ${destinationFields!.version}).`);walk(v,path?`${path}.${k}`:k);}return;}
  if(typeof x==='string'&&ids.has(x.trim().toLowerCase()))problems.push(`A value at ${path} matches a patient identifier, name or ABHA number.`);
 };
 walk(payload,'');if(!aggregateEnvelopeSchema.safeParse(payload).success)problems.push('Aggregate envelope differs from its mapped path contract.');
 for(const b of (Array.isArray((payload as any)?.blocks)?(payload as any).blocks:[]) as any[])for(const c of (Array.isArray(b?.cells)?b.cells:[]) as any[]){cells++;
  if(c?.suppressed){if([c.value,c.numerator,c.denominator].some(v=>v!==null))problems.push('A suppressed cell carries a value.');continue;}
  const parts=[c?.numerator,c?.denominator,b?.unit==='count'?c?.value:null,b?.unit==='proportion'&&typeof c?.denominator==='number'&&typeof c?.numerator==='number'?c.denominator-c.numerator:null];
  if(parts.some(small))problems.push(`A released cell is below the suppression threshold of ${MIN_CELL}.`);}
 return {at,stage,passed:problems.length===0,fields,cells,problems:[...new Set(problems)].slice(0,20)};
  if(parts.some(small))problems.push(`A released cell in ${b.indicator} v${b.version} (${b.team}) is below the suppression threshold of ${MIN_CELL}.`);}
 return {at,stage,passed:problems.length===0,fields,cells,problems:[...new Set(problems)].slice(0,20),...(destinationFields?{destinationAllowlistVersion:destinationFields.version,destinationAllowlistExplicit:destinationFields.explicit}:{})};
}
// ---- approval ----
export function approveReport(s:OrgState,c:Extract<AggregateCommand,{type:'approveAggregateReport'}>,u:Actor,m:Member,now:string){
 const r=findReport(s,c.reportId);reportingScope(m,r.teamIds);
 if(r.state!=='prepared')fail(409,'Only a prepared report can be approved.');
 // Slice 6ad: a report not approved within the approval window has expired.
 if(Date.parse(r.preparedAt)+APPROVAL_HOURS*3600000<Date.parse(now))fail(409,`This report was prepared more than ${APPROVAL_HOURS} hours ago and has expired. Prepare a new report.`);
 if(r.preparedBy===u.userId)fail(403,'A different authorised person must approve this report.');
 if(r.payloadSha256!==c.payloadSha256)fail(409,'The report is not the one you reviewed. Refresh and review it again.');
 const i=aggregateDestination(s,r.destinationId),refused=aggregateRefusal(i,'before-send',now);if(refused)fail(409,refused.text);
 r.state='approved';r.approvedBy=u.userId;r.approvedByName=u.displayName;r.approvedAt=now;r.expiresAt=new Date(Date.parse(now)+APPROVAL_HOURS*3600000).toISOString();
 reportEvent(r,now,`Approved by ${u.displayName}. Send within ${APPROVAL_HOURS} hours; the preparer or the approver may send it.`);
 s.workspace.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:m.role,action:'approveAggregateReport',subject:r.id,detail:`Aggregate report ${r.id} for ${r.destinationName} approved: ${r.rowCount} rows, SHA-256 ${r.payloadSha256}.`});
 return {reportId:r.id,state:r.state,expiresAt:r.expiresAt};
}
export function reportEvent(r:AggregateReport,at:string,detail:string){r.updatedAt=at;r.message=detail;r.events.push({at,state:r.state,detail});}
// ---- the demonstration destination ----
export const aggregateReceiptSchema=z.object({contract:z.literal(AGGREGATE_CONTRACT),key:id,payloadHash:z.string().regex(/^[a-f0-9]{64}$/),status:z.enum(['accepted','rejected','pending','not_found']),receipt:z.string().min(1).max(200).optional()}).strict().superRefine((x,ctx)=>{
 // SAHA-075 / BR-INT-04: a bare "accepted" assertion is not authoritative evidence. Without the destination's
 // receipt the outcome remains uncertain and must be reconciled; it must never be promoted to accepted or retried.
 if(x.status==='accepted'&&!x.receipt)ctx.addIssue({code:z.ZodIssueCode.custom,path:['receipt'],message:'An accepted destination result must include its receipt.'});
});
export type AggregateTransport=(i:Integration,body:any,key:string)=>Promise<unknown>;
// A deterministic in-process simulator. A destination with behaviour "uncertain" stores the report but its response
// is lost on the first send; a lookup then finds the receipt without the report being sent again.
export const demoAggregateTransport:AggregateTransport=async(i,body,key)=>{
 await assertAggregateEnvelope(body,key);
 // A lookup carries the report key in its body; its own request key is separate.
 const reportKey=body.operation==='lookup'?body.key:key,receipt=`AGG-${(await sha256Hex(`${i.id}:${reportKey}`)).slice(0,8).toUpperCase()}`;
 if(body.operation==='lookup')return {contract:AGGREGATE_CONTRACT,key:reportKey,payloadHash:body.payloadHash,status:'accepted',receipt};
 if(i.behavior==='uncertain')throw new Error('Simulated lost response.');
 return {contract:AGGREGATE_CONTRACT,key,payloadHash:body.manifest.sha256,status:'accepted',receipt};
};
export function applyAggregateReceipt(r:AggregateReport,raw:unknown,lookup:boolean,now:string){
 const p=aggregateReceiptSchema.safeParse(raw);if(!p.success)fail(502,'The destination response did not match the aggregate receipt contract.');const x=p.data!;
 if(x.key!==r.id||x.payloadHash!==r.payloadSha256)fail(502,'The destination receipt names a different report.');
 r.state=x.status==='accepted'?'accepted':x.status==='rejected'?'rejected':x.status==='not_found'?'uncertain':'uncertain';if(x.receipt)r.receipt=x.receipt;
 reportEvent(r,now,x.status==='accepted'?`Destination confirmed receipt ${x.receipt??''}${lookup?' by lookup; the report was not sent again':''}.`:x.status==='rejected'?'Destination rejected this report. Prepare a new report if it is still needed.':x.status==='not_found'?'Destination has no report under this key. The outcome stays unresolved; contact the destination before preparing a new report.':'Destination is still processing. Look up the receipt; do not resend.');
}
