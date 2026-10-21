import type {D1Database} from '@cloudflare/workers-types';
import {fail,uuid} from './core';
import {ehrAudit,ehrCredential,ehrIntegration,type EhrCommand} from './ehr';
import {capabilities,type fhirRequest} from './ehr-provider';
import {ensureOperating} from './operations';
import {persist,readState,scope,type Actor} from './store';
import {linkTrace} from './trace';
import type {Member,OrgState} from './types';
// A capability probe is an owner-only, metadata-only pre-activation check. It
// reserves its receipt and durable audit before the transport, regardless of a
// service binding. It never activates the connection or approves patient exchange.
export async function executeEhrProbe(db:D1Database,s:OrgState,c:Extract<EhrCommand,{type:'probeEhr'}>,u:Actor,m:Member,key:string,hash:string,env:Record<string,string|undefined>,transport:typeof fhirRequest){
 if(!m.isOwner)fail(403,'Owner access required.');ensureOperating(s,c);
 const i=ehrIntegration(s,c.integrationId);if(i.version!==c.version||!i.ehr)fail(409,'Save current capabilities before testing.');ehrCredential(i,s.organisation.id,env);
 const before=structuredClone(s);ehrAudit(s,u,m,c.type,i.id,'Metadata capability probe reserved before the external request. No patient data sent; connection remains in its current activation state.');linkTrace(before,s,c.type,key,u.userId,undefined,key);await persist(db,before,s,u,c,key,hash,{status:'testing',integrationId:i.id,version:i.version});
 const raw=await transport(i,s.organisation.id,env,'metadata',{},undefined,key),caps=capabilities(raw);
 const after=await readState(db,s.organisation.id),member=scope(after,u.userId);if(!member.isOwner)fail(403,'Owner access changed.');ensureOperating(after,c);
 const target=ehrIntegration(after,i.id);if(target.version!==i.version||target.status!==i.status)fail(409,'EHR configuration changed during the test.');
 const old=structuredClone(after);target.ehr!.test={at:new Date().toISOString(),version:i.version,...caps,message:'CapabilityStatement checked. A partner acceptance test is still required.'};ehrAudit(after,u,member,'ehrProbeResult',i.id,target.ehr!.test.message);const finish='ehr_probe_'+uuid();linkTrace(old,after,'ehrProbeResult',finish,u.userId);await persist(db,old,after,u,{type:'ehrProbeResult'},finish,hash,caps);return caps;
}
