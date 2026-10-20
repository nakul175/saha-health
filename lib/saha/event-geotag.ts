import {z} from 'zod';
import {allowed} from './access';
import {fail,person,uuid,visit} from './core';
import {defaultOperations} from './operations';
import type {Actor} from './store';
import type {Member,OrgState} from './types';

export const EVENT_LOCATION_KINDS=['visit'] as const;
export type EventLocationKind=typeof EVENT_LOCATION_KINDS[number];
export type EventLocationPurpose={id:string;label:string};
export type EventLocationPolicy={version:number;state:'draft'|'active';eligibleEventKinds:EventLocationKind[];purposes:EventLocationPurpose[];precisionDecimals:number;retentionDays:number;authorityReference:string;reason:string;setBy:string;setAt:string};
export type EventGeotag={id:string;version:number;eventKind:'visit';eventId:string;personId:string;purposeId:string;permission:'granted'|'declined'|'denied'|'unavailable';mode:'gps'|'no-gps';latitude?:number;longitude?:number;accuracyMetres?:number;capturedAt?:string;provenance:'device-geolocation'|'worker-no-gps';noGpsReason?:string;policyVersion:number;authorityReference:string;recordedBy:string;recordedAt:string;expiresAt:string};

const id=z.string().trim().regex(/^[A-Za-z0-9_:.-]{1,120}$/),note=z.string().trim().min(10).max(500);
const purpose=z.object({id:z.string().trim().regex(/^[a-z][a-z0-9-]{1,50}$/),label:z.string().trim().min(2).max(100)}).strict();
const gps=z.object({latitude:z.number().finite().min(-90).max(90),longitude:z.number().finite().min(-180).max(180),accuracyMetres:z.number().finite().min(0).max(10000),capturedAt:z.string().datetime()}).strict();
export const eventGeotagSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('setEventLocationPolicy'),version:z.number().int().min(0),state:z.enum(['draft','active']),eligibleEventKinds:z.array(z.enum(EVENT_LOCATION_KINDS)).min(1).max(EVENT_LOCATION_KINDS.length),purposes:z.array(purpose).min(1).max(20),precisionDecimals:z.number().int().min(2).max(5),retentionDays:z.number().int().min(1).max(365),authorityReference:z.string().trim().min(5).max(200),reason:note}).strict(),
 z.object({type:z.literal('purgeExpiredEventGeotags'),reason:note}).strict(),
 z.object({type:z.literal('recordEventGeotag'),personId:id,visitId:id,version:z.number().int().positive(),purposeId:z.string().trim().regex(/^[a-z][a-z0-9-]{1,50}$/),permission:z.enum(['granted','declined','denied','unavailable']),location:gps.optional(),noGpsReason:note.optional()}).strict(),
]);
export type EventGeotagCommand=z.infer<typeof eventGeotagSchema>;

type EventOperations=NonNullable<OrgState['operations']>&{eventLocationPolicy?:EventLocationPolicy};
type EventVisit=OrgState['workspace']['visits'][number]&{eventGeotags?:EventGeotag[]};
const eventOperations=(s:Pick<OrgState,'operations'>)=>s.operations as EventOperations|undefined;
const eventVisit=(value:OrgState['workspace']['visits'][number])=>value as EventVisit;
export const policyOf=(s:Pick<OrgState,'operations'>):EventLocationPolicy|undefined=>eventOperations(s)?.eventLocationPolicy;
function care(m:Member){if(!['asha','clinician'].includes(m.role))fail(403,'A current care role is required to record an event location outcome.');}
function accessibleVisit(s:OrgState,m:Member,personId:string,visitId:string){const p=person(s.workspace,personId);if(!allowed(m,p))fail(403,'This event is outside your current care scope.');const v=visit(s.workspace,visitId);if(v.personId!==p.id)fail(404,'This visit does not belong to the selected person.');if(v.imported||v.voidedAt||v.supersededBy)fail(409,'Choose a current Saha visit for this event.');return {p,v};}
export function authorizeEventGeotag(s:OrgState,m:Member,input:{type?:string;personId?:string;visitId?:string}){
 if(input.type==='setEventLocationPolicy'||input.type==='purgeExpiredEventGeotags'){if(!m.isOwner)fail(403,'Only an organisation owner can configure event location controls.');return;}
 if(input.type==='recordEventGeotag'){care(m);if(!input.personId||!input.visitId)fail(422,'Choose one person and visit.');accessibleVisit(s,m,input.personId,input.visitId);}
}
const rounded=(value:number,places:number)=>Number(value.toFixed(places));
export function applyEventGeotag(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()){
 const parsed=eventGeotagSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeEventGeotag(s,m,c);
 if(c.type==='setEventLocationPolicy'){
  const ops=(s.operations??=defaultOperations()) as EventOperations,current=ops.eventLocationPolicy;if((current?.version??0)!==c.version)fail(409,'Event location policy changed. Refresh and review the current policy.');
  if(new Set(c.eligibleEventKinds).size!==c.eligibleEventKinds.length)fail(422,'List each eligible event kind once.');if(new Set(c.purposes.map(x=>x.id)).size!==c.purposes.length)fail(422,'List each approved location purpose once.');
  const policy:EventLocationPolicy={...c,eligibleEventKinds:[...c.eligibleEventKinds].sort(),purposes:[...c.purposes].map(x=>({id:x.id.trim(),label:x.label.trim()})).sort((a,b)=>a.id.localeCompare(b.id)),version:(current?.version??0)+1,setBy:u.userId,setAt:now};delete (policy as Partial<EventGeotagCommand>).type;
  ops.eventLocationPolicy=policy;ops.version++;ops.updatedAt=now;s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:s.organisation.id,detail:`Event location policy ${policy.version} saved as ${policy.state}; ${policy.precisionDecimals} decimal places; ${policy.retentionDays} day disclosure retention; no background tracking or provider enabled. Reason: ${c.reason}`});return {policyVersion:policy.version,state:policy.state};
 }
 if(c.type==='purgeExpiredEventGeotags'){
  let removed=0;
  for(const rawVisit of s.workspace.visits){const v=eventVisit(rawVisit),before=v.eventGeotags??[],retained=before.filter(item=>item.expiresAt>now);removed+=before.length-retained.length;if(retained.length!==before.length)v.eventGeotags=retained;}
  s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:s.organisation.id,detail:`Governed event-location retention cleanup physically removed ${removed} expired record(s). Coordinates and no-GPS detail were removed; the count-only audit evidence remains. Reason: ${c.reason}`});
  return {removed,completedAt:now};
 }
 const policy=policyOf(s);if(!policy||policy.state!=='active')fail(409,'An active owner-approved event location policy is required.');if(!policy.eligibleEventKinds.includes('visit'))fail(409,'Visit events are not eligible under the current location policy.');if(!policy.purposes.some(x=>x.id===c.purposeId))fail(422,'Choose a purpose approved by the current location policy.');
 const {v:rawVisit}=accessibleVisit(s,m,c.personId,c.visitId),v=eventVisit(rawVisit);if(v.recordVersion!==c.version)fail(409,'This visit changed. Refresh before recording its location outcome.');const at=Date.parse(now),days=policy.retentionDays*86400000,prior=v.eventGeotags??[],nextVersion=(prior.at(-1)?.version??0)+1,history=prior.filter(item=>item.expiresAt>now),expiredCount=prior.length-history.length;v.eventGeotags=history;
 let geotag:EventGeotag;if(c.permission==='granted'){
  if(!c.location||c.noGpsReason)fail(422,'A granted one-time location needs one device reading and no no-GPS reason.');const captured=Date.parse(c.location.capturedAt);if(!Number.isFinite(captured)||captured<at-10*60000||captured>at+60000)fail(422,'The device location is stale or in the future. Capture it again for this event.');
  geotag={id:uuid(),version:nextVersion,eventKind:'visit',eventId:v.id,personId:v.personId,purposeId:c.purposeId,permission:c.permission,mode:'gps',latitude:rounded(c.location.latitude,policy.precisionDecimals),longitude:rounded(c.location.longitude,policy.precisionDecimals),accuracyMetres:Math.round(c.location.accuracyMetres),capturedAt:c.location.capturedAt,provenance:'device-geolocation',policyVersion:policy.version,authorityReference:policy.authorityReference,recordedBy:u.userId,recordedAt:now,expiresAt:new Date(at+days).toISOString()};
 }else{
  if(c.location||!c.noGpsReason)fail(422,'The no-GPS path needs a reason and cannot contain coordinates.');geotag={id:uuid(),version:nextVersion,eventKind:'visit',eventId:v.id,personId:v.personId,purposeId:c.purposeId,permission:c.permission,mode:'no-gps',noGpsReason:c.noGpsReason,provenance:'worker-no-gps',policyVersion:policy.version,authorityReference:policy.authorityReference,recordedBy:u.userId,recordedAt:now,expiresAt:new Date(at+days).toISOString()};
 }
 if(history.length>=20)fail(422,'This event location history is full; request a retention review before adding another entry.');history.push(geotag);s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:v.id,personId:v.personId,detail:`Purpose-limited ${geotag.mode} event location outcome recorded for purpose ${geotag.purposeId} under policy ${policy.version}. ${expiredCount>0?`${expiredCount} expired location record(s) were removed under retention. `:''}${geotag.mode==='gps'?'Coordinates were minimised to the configured precision.':'No coordinates were stored.'}`});return {geotagId:geotag.id,mode:geotag.mode,version:geotag.version,expiresAt:geotag.expiresAt};
}

export function eventGeotagView(s:OrgState,m:Member,personId:string,visitId:string,now=new Date().toISOString()){
 const {p,v:rawVisit}=accessibleVisit(s,m,personId,visitId),v=eventVisit(rawVisit),policy=policyOf(s);return {person:{id:p.id,name:p.name},visit:{id:v.id,version:v.recordVersion,state:v.state},policy:policy?{version:policy.version,state:policy.state,eligibleEventKinds:policy.eligibleEventKinds,purposes:policy.purposes,precisionDecimals:policy.precisionDecimals,retentionDays:policy.retentionDays}:null,geotags:(v.eventGeotags??[]).map(g=>g.expiresAt<=now?{id:g.id,version:g.version,eventKind:g.eventKind,eventId:g.eventId,purposeId:g.purposeId,permission:g.permission,mode:g.mode,provenance:g.provenance,policyVersion:g.policyVersion,recordedAt:g.recordedAt,expiresAt:g.expiresAt,expired:true}:{...g,expired:false})};
}
