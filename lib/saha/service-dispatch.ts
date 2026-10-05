import type {D1Database} from '@cloudflare/workers-types';
import {fail} from './core';
import {readState,scope,type Actor} from './store';
import {normallyAllowed} from './access';
import {recordAccess} from './access-audit';
import {independentTargets,requireServiceIdentity} from './service-identity';
import type {OrgState,Member} from './types';
// Opt-in authority. A binding cannot be removed/replaced between preparation and dispatch
// to bypass a revocation. Completed receipts remain evidence and never trigger dispatch.
export async function serviceDispatch(db:D1Database,s:OrgState,u:Actor,m:Member,targetId:string,personId:string|null=null){
 const expected=s.operations?.serviceBindings?.[targetId];
 if(!expected)return;
 // Always read at the execution boundary, for the explicitly referenced service binding.
 const fresh=await readState(db,s.organisation.id),bound=fresh.operations?.serviceBindings?.[targetId];
 if(expected&&expected!==bound)fail(403,'Service authority changed. Nothing was sent.');
 const member=scope(fresh,u.userId);
 if(member.version!==m.version||member.role!==m.role)fail(403,'Initiating human authority changed. Nothing was sent.');
 if(personId){const p=fresh.workspace.people.find(x=>x.id===personId);if(!p||!normallyAllowed(member,p,fresh.operations?.accessScope))fail(403,'Patient scope changed. Nothing was sent.');}
 const i=fresh.workspace.integrations.find(x=>x.id===targetId),kind=i?.kind==='ai'||targetId.startsWith('frontline:')||targetId==='independent:anaemia'||targetId==='openai'?'agent':'connector';
 if(!i&&!independentTargets.includes(targetId))fail(403,'Service target no longer exists. Nothing was sent.');
 if(i&&i.status!=='active')fail(403,'Service target is no longer active. Nothing was sent.');
 const si=requireServiceIdentity(fresh,bound!,kind,targetId);
 await recordAccess(db,fresh,u,member,{action:'externalRequest',subject:targetId,personId,detail:`Service dispatch authorised: initiating human ${u.userId}; service ${si.id}; target ${targetId}; accountable owner ${si.ownerId}; expires ${si.expiresAt}.`});
 const checkpoint=await readState(db,s.organisation.id),current=scope(checkpoint,u.userId);
 if(checkpoint.operations?.serviceBindings?.[targetId]!==expected||current.version!==m.version||current.role!==m.role)fail(403,'Service or initiating human authority changed during audit. Nothing was sent.');
 requireServiceIdentity(checkpoint,expected,kind,targetId);
 if(personId){const p=checkpoint.workspace.people.find(x=>x.id===personId);if(!p||!normallyAllowed(current,p,checkpoint.operations?.accessScope))fail(403,'Patient scope changed during audit. Nothing was sent.');}
 if(i&&checkpoint.workspace.integrations.find(x=>x.id===targetId)?.status!=='active')fail(403,'Service target changed during audit. Nothing was sent.');
}
