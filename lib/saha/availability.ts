import type {D1Database} from '@cloudflare/workers-types';
import type {Member,OrgState} from './types';
import type {Actor} from './store';
import {persistAvailabilitySample,readState,scope} from './store';
import {digest,fail,uuid} from './core';
import {environmentOf,POLICY} from './environment';
import {receiptSchema} from './mis';
import {AVAILABILITY_CADENCE_MS as CADENCE,type AvailabilityConfig,type AvailabilitySample} from './availability-types';
export const AVAILABILITY_NOTICE='Five-minute checks inside this application process. Core means database read plus durable audited sample; end-to-end means a fixed synthetic local programme receipt contract and audit write. No clinical records, external requests or live destination delivery. Scheduler gaps are unknown, not healthy. Independent HTTP/platform uptime and the 99.5% hosted target remain unmeasured.';
export const MAX_MONTH_ROWS=17856; // 31 UTC days * 288 slots * two independently labelled sources.
export async function sampleAvailability(d:D1Database,initial:OrgState,source:AvailabilitySample['source'],actor:Actor,member:Member|null,at=new Date().toISOString(),env:Record<string,string|undefined>={}){
 const config=initial.operations?.availability;if(!config?.enabled)return {recorded:false,reason:'disabled'};
 if(!POLICY[environmentOf(env).name].fixtures)return {recorded:false,reason:'environment'};
 const slot=Math.floor(Date.parse(at)/CADENCE)*CADENCE,period=config.periods.find(p=>p.version===config.version&&p.until===null&&Date.parse(p.from)<=slot);
 if(!period)return {recorded:false,reason:'activation-boundary'};
 if(await d.prepare('SELECT slot FROM availability_samples WHERE org_id=? AND slot=? AND source=?').bind(initial.organisation.id,slot,source).first())return {recorded:false,reason:'duplicate'};
 const started=Date.now();let core:AvailabilitySample['core']='healthy';try{const r=await d.prepare('SELECT 1 AS ready FROM organisations WHERE id=?').bind(initial.organisation.id).first<{ready:number}>();if(r?.ready!==1)core='failed';}catch{core='failed';}
 const fresh=await readState(d,initial.organisation.id,[]);
 if(JSON.stringify(fresh.operations?.availability)!==JSON.stringify(config)||!!fresh.operations?.maintenance!==!!initial.operations?.maintenance)fail(409,'Availability configuration changed during the check.');
 const current=member?scope(fresh,actor.userId):null;if(current&&(!(current.isOwner||current.role==='admin')||current.role!==member?.role||current.isOwner!==member?.isOwner))fail(403,'Current operations access required.');
 const maintenance=!!fresh.operations?.maintenance,dependency=fresh.workspace.integrations.find(i=>i.id===period.dependencyId);
 const receipt_hash=await digest({contract:'saha-mis-v1',purpose:'synthetic-availability-only',slot,version:period.version});
 // Fixed public synthetic values only. The real local receipt schema is exercised;
 // clinical submission paths and all HTTP connectors remain untouched.
 const receipt=receiptSchema.safeParse({contract:'saha-mis-v1',key:'synthetic-availability',payloadHash:receipt_hash,status:'accepted',receipt:'synthetic-local-receipt'});
 const workflow:AvailabilitySample['workflow']=maintenance?'maintenance':period.dependencyId===null?'not-configured':dependency?.mode==='demo'&&dependency.kind==='mis'&&dependency.status==='active'&&receipt.success?'healthy':'dependency-unavailable';
 const sample:AvailabilitySample={org_id:fresh.organisation.id,slot,source,config_version:period.version,core,workflow,latency_ms:Math.min(60000,Math.max(0,Date.now()-started)),receipt_hash,recorded_at:at};
 const recorded=await persistAvailabilitySample(d,config,maintenance,sample,{id:uuid(),at,actorId:actor.userId,actor:actor.displayName,role:current?.role??'admin',action:'availabilityProbe',subject:fresh.organisation.id,detail:`Synthetic availability sample; ${source}; UTC slot ${new Date(slot).toISOString()}; configuration ${period.version}; core ${core}; local receipt ${workflow}. No external delivery.`},current,dependency??null,period.dependencyId);
 if(!recorded){const duplicate=await d.prepare('SELECT slot FROM availability_samples WHERE org_id=? AND slot=? AND source=?').bind(fresh.organisation.id,slot,source).first();if(duplicate)return {recorded:false,reason:'duplicate'};fail(409,'Availability authority or configuration changed before recording.');}
 return {recorded:true,slot,source,core,workflow};
}
export function availabilityMonth(month:string,now=new Date()){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))fail(422,'Choose a UTC month in YYYY-MM format.');
 const start=Date.parse(month+'-01T00:00:00Z'),end=Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1),current=Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1);
 if(start>current||start<Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-11,1))fail(422,'Choose the current month or one of the previous eleven UTC months.');
 return {start,end,until:Math.min(end,Math.floor(now.getTime()/CADENCE)*CADENCE)};
}
export function availabilityReport(config:AvailabilityConfig|undefined,rows:AvailabilitySample[],month:string,now=new Date()){
 const window=availabilityMonth(month,now),samples=new Map(rows.filter(r=>r.source==='scheduler').map(r=>[r.slot,r]));let expected=0,observed=0,coreHealthy=0,endToEndHealthy=0,maintenance=0,dependencyFailures=0,coreFailures=0,endToEndExpected=0,endToEndObserved=0,notConfigured=0;
 for(let slot=window.start;slot<window.until;slot+=CADENCE){const p=config?.periods.find(p=>Date.parse(p.from)<=slot&&(p.until===null||slot<Date.parse(p.until)));if(!p)continue;expected++;if(p.dependencyId!==null)endToEndExpected++;else notConfigured++;const row=samples.get(slot);if(p.maintenance||row?.workflow==='maintenance')maintenance++;if(!row||row.config_version!==p.version)continue;observed++;if(p.dependencyId!==null)endToEndObserved++;if(row.core==='healthy')coreHealthy++;else coreFailures++;if(row.workflow==='healthy'&&row.core==='healthy')endToEndHealthy++;if(row.workflow==='dependency-unavailable')dependencyFailures++;}
 const coverage=expected?observed/expected:null;return {month,timezone:'UTC',cadenceSeconds:300,closedSlotsThrough:new Date(window.until).toISOString(),targetPercent:99.5,hostedTargetAssessment:'unmeasured',notice:AVAILABILITY_NOTICE,enabled:config?.enabled??false,configurationVersion:config?.version??0,activationWindows:config?.periods??[],scheduler:{expected,observed,missing:expected-observed,coverage,maintenance,core:{healthy:coreHealthy,failed:coreFailures,confirmedHealthyFraction:expected?coreHealthy/expected:null},endToEnd:{expected:endToEndExpected,observed:endToEndObserved,missing:endToEndExpected-endToEndObserved,notConfigured,healthy:endToEndHealthy,dependencyFailures,confirmedHealthyFraction:endToEndExpected?endToEndHealthy/endToEndExpected:null}},manualHttp:{observed:rows.filter(r=>r.source==='manual-http'&&r.slot<window.until).length,coverage:'On-demand authenticated requests that reached this process; no independent scheduled observer or outage denominator.'}};
}
export async function readAvailabilityReport(d:D1Database,s:OrgState,month:string,now=new Date()){
 const w=availabilityMonth(month,now),rows=await d.prepare('SELECT org_id,slot,source,config_version,core,workflow,latency_ms,receipt_hash,recorded_at FROM availability_samples WHERE org_id=? AND slot>=? AND slot<? ORDER BY slot,source LIMIT ?').bind(s.organisation.id,w.start,w.end,MAX_MONTH_ROWS+1).all<AvailabilitySample>();if(rows.results.length>MAX_MONTH_ROWS)fail(503,'Availability history exceeded its bounded cadence.');return availabilityReport(s.operations?.availability,rows.results,month,now);
}
