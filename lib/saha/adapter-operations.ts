import { z } from 'zod';
import type { Integration, Member, OrgState } from './types';
import type { Actor } from './store';

// Slice 7e: separate operation permissions for every record adapter (BR-INT-02, BR-INT-09).
//
// Each programme destination (HTTP or demonstration), EHR connection and the mock ABDM gateway declares the
// operations it may perform: create, update, delete (void), lookup and aggregate. The setting is stored with
// the integration, versioned, audited and changed by organisation owners only. An integration with no stored
// setting uses DEFAULT_OPERATIONS, which is exactly what the release did before this slice.
//
// "Aggregate-only" is a programme-destination policy: the destination may receive aggregate reports only,
// never a patient-level record, whatever other operations say. EHR and ABDM exchange is patient-level by
// nature and cannot be aggregate-only.
//
// Every execution path asks operationRefusal() on the server before preparing and again inside its external
// execution checkpoint. A refusal after preparation closes the item as not sent (never a blind retry) and
// records `refusal` on it, which the trace and the exception queue show.
//
// This module has no runtime imports so every harness that transpiles core can list it without others.
export const ADAPTER_OPERATIONS=['create','update','delete','lookup','aggregate'] as const;
export type AdapterOperation=typeof ADAPTER_OPERATIONS[number];
export type GovernedKind='mis'|'ehr'|'abdm';
export type OperationSetting={version:number;allowed:AdapterOperation[];aggregateOnly:boolean;setBy:string;setAt:string;reason:string};
export type AdapterOperations=OperationSetting&{history:OperationSetting[]};
export type Refusal={operation:AdapterOperation;settingVersion:number;aggregateOnly:boolean;stage:'before-send'|'checkpoint';at:string};
export const OPERATIONS_POLICY_VERSION='1.0.0';
export const HISTORY_LIMIT=20;
export const LABEL:Record<AdapterOperation,string>={create:'Create',update:'Update',delete:'Delete or void',lookup:'Lookup',aggregate:'Aggregate reports'};
const VERB:Record<AdapterOperation,string>={create:'create records',update:'update records',delete:'delete or void records',lookup:'look up records or receipts',aggregate:'receive aggregate reports'};
// Where this release uses each operation; an empty string means Saha has no path for it.
export const OPERATION_PATHS:Record<GovernedKind,Record<AdapterOperation,string>>={
 mis:{create:'Send a confirmed visit as a new submission',update:'Send the correction of an accepted submission',delete:'',lookup:'Look up a delivery receipt',aggregate:''},
 ehr:{create:'Publish a confirmed visit document',update:'',delete:'',lookup:'Look up a publication receipt',aggregate:''},
 abdm:{create:'Link an ABHA or care contexts on the mock gateway',update:'',delete:'Unlink an ABHA on the mock gateway (a consent revocation always applies in Saha; this decides whether the gateway is told)',lookup:'Request consent and fetch records under a granted consent (mock HIU)',aggregate:''},
};
export const NO_PATH='No path in this release. Changes of this kind need a separate process agreed with the partner.';
export const DEFAULT_OPERATIONS:Record<GovernedKind,AdapterOperation[]>={mis:['create','update','lookup'],ehr:['create','lookup'],abdm:['create','delete','lookup']};
export const governed=(i:Pick<Integration,'kind'>|undefined|null):boolean=>!!i&&['mis','ehr','abdm'].includes(i.kind);
const canonical=(xs:readonly AdapterOperation[])=>ADAPTER_OPERATIONS.filter(x=>xs.includes(x));
// The effective setting; version 0 is the built-in default (nothing stored yet).
export function operationsOf(i:Integration):{version:number;allowed:AdapterOperation[];aggregateOnly:boolean;explicit:boolean}{
 const o=i.operations;if(o)return {version:o.version,allowed:canonical(o.allowed),aggregateOnly:!!o.aggregateOnly,explicit:true};
 return {version:0,allowed:governed(i)?[...DEFAULT_OPERATIONS[i.kind as GovernedKind]]:[],aggregateOnly:false,explicit:false};
}
// What a request carries to the destination: a patient-level record, an aggregate report, or neither (a receipt lookup).
export type Carries='patient'|'aggregate'|'none';
// null when allowed; otherwise the refusal text. Integrations that are not record adapters (AI providers) are not governed here.
export function operationRefusal(i:Integration,op:AdapterOperation,carries:Carries='patient'):string|null{
 if(!governed(i))return null;const o=operationsOf(i);
 if(carries==='patient'&&o.aggregateOnly)return `${i.name} is an aggregate-only destination: it may receive aggregate reports only, never a patient-level record.`;
 if(!o.allowed.includes(op))return `${i.name} is not permitted to ${VERB[op]} (operation setting version ${o.version}).`;
 return null;
}
export function refusalOf(i:Integration,op:AdapterOperation,stage:Refusal['stage'],now=new Date().toISOString()):Refusal{const o=operationsOf(i);return {operation:op,settingVersion:o.version,aggregateOnly:o.aggregateOnly,stage,at:now};}
// MIS payloads say whether they create a record or correct an accepted one.
export const misOperation=(payload:any):AdapterOperation=>payload?.operation==='correct'?'update':'create';

const id=z.string().min(1).max(200);
export const adapterOperationsSchema=z.object({type:z.literal('setAdapterOperations'),integrationId:id,version:z.number().int().min(0),allowed:z.array(z.enum(ADAPTER_OPERATIONS)).max(ADAPTER_OPERATIONS.length).refine(x=>new Set(x).size===x.length,'List each operation once.'),aggregateOnly:z.boolean(),reason:z.string().trim().min(5).max(500)}).strict()
 .refine(c=>!c.aggregateOnly||(c.allowed.includes('aggregate')&&!c.allowed.some(x=>['create','update','delete'].includes(x))),'An aggregate-only destination allows aggregate reports and may allow lookups, but never create, update or delete.');
export type AdapterOperationsCommand=z.infer<typeof adapterOperationsSchema>;
// Returns null when the input is not this slice's command. Errors are thrown through `fail` supplied by the caller.
export function applyAdapterOperations(s:OrgState,input:unknown,u:Actor,m:Member,fail:(status:number,message:string)=>never,uuid:()=>string,now=new Date().toISOString()){
 if((input as any)?.type!=='setAdapterOperations')return null;
 if(!m.isOwner)fail(403,'Only an organisation owner can change the operations a connection may perform.');
 const parsed=adapterOperationsSchema.safeParse(input);if(!parsed.success)fail(422,parsed.error.issues[0]?.message??'Invalid operation setting.');const c=parsed.data!;
 const i=s.workspace.integrations.find(x=>x.id===c.integrationId);if(!i||!governed(i))fail(422,'Choose a programme, EHR or ABDM connection.');const target=i!;
 const current=operationsOf(target);if(current.version!==c.version)fail(409,'The operation setting changed. Refresh and review it again.');
 if(c.aggregateOnly&&target.kind!=='mis')fail(422,'Only a programme destination can be aggregate-only. EHR and ABDM exchange is patient-level.');
 const allowed=canonical(c.allowed);if(allowed.join()===current.allowed.join()&&c.aggregateOnly===current.aggregateOnly)fail(409,'Nothing changed.');
 const prior:OperationSetting[]=target.operations?[...target.operations.history,{version:target.operations.version,allowed:target.operations.allowed,aggregateOnly:target.operations.aggregateOnly,setBy:target.operations.setBy,setAt:target.operations.setAt,reason:target.operations.reason}]:[];
 target.operations={version:current.version+1,allowed,aggregateOnly:c.aggregateOnly,setBy:u.userId,setAt:now,reason:c.reason,history:prior.slice(-HISTORY_LIMIT)};
 const list=allowed.length?allowed.map(x=>LABEL[x].toLowerCase()).join(', '):'none';
 s.workspace.audit.push({id:uuid(),at:now,actor:u.displayName,actorId:u.userId,role:m.role,action:'setAdapterOperations',subject:target.id,detail:`${target.name}: permitted operations set to ${list}${c.aggregateOnly?'; aggregate reports only':''} (setting version ${target.operations.version}). Every send and lookup rechecks this setting; items already prepared are closed as not sent if their operation is withdrawn. Reason: ${c.reason}`});
 return {integrationId:target.id,version:target.operations.version,allowed,aggregateOnly:c.aggregateOnly};
}
