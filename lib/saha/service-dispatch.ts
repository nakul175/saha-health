import type {D1Database} from '@cloudflare/workers-types';
import {fail} from './core';
import {readState,scope,type Actor} from './store';
import {normallyAllowed,purposePermits} from './access';
import {recordAccess} from './access-audit';
import {frontlineAgreement,independentTargets,requireServiceIdentity} from './service-identity';
import type {OrgState,Member} from './types';
import type {AccessPurpose} from './purpose-scope';
export type DispatchContext={intent:'send'|'lookup'|'probe';purpose?:AccessPurpose;authorize?:(state:OrgState,member:Member)=>void|Promise<void>};
// Opt-in authority. A binding cannot be removed/replaced between preparation and dispatch
// to bypass a revocation. Completed receipts remain evidence and never trigger dispatch.
export async function serviceDispatch(db:D1Database,s:OrgState,u:Actor,m:Member,targetId:string,personId:string|null=null,context?:DispatchContext){
 const expected=s.operations?.serviceBindings?.[targetId];
 // Always read at the execution boundary, for the explicitly referenced service binding.
 const fresh=await readState(db,s.organisation.id),bound=fresh.operations?.serviceBindings?.[targetId];
 const member=scope(fresh,u.userId);
 await domain(fresh,member);
 if(!expected&&!bound)return;
 if(expected!==bound)fail(403,'Service authority changed. Nothing was sent.');
 if(member.version!==m.version||member.role!==m.role)fail(403,'Initiating human authority changed. Nothing was sent.');
 if(personId){const p=fresh.workspace.people.find(x=>x.id===personId);if(!p||!normallyAllowed(member,p,fresh.operations?.accessScope))fail(403,'Patient scope changed. Nothing was sent.');}
 const i=fresh.workspace.integrations.find(x=>x.id===targetId),kind=i?.kind==='ai'||targetId.startsWith('frontline:')||targetId==='independent:anaemia'||targetId==='openai'?'agent':'connector';
 if(!i&&!independentTargets.includes(targetId))fail(403,'Service target no longer exists. Nothing was sent.');
 if(i&&!targetAvailable(i,context?.intent==='probe'))fail(403,'Service target is no longer active. Nothing was sent.');
 assertTarget(s,fresh,targetId,context?.intent==='probe');
 const si=requireServiceIdentity(fresh,bound!,kind,targetId);
 await recordAccess(db,fresh,u,member,{action:'externalRequest',subject:targetId,personId,detail:`Service dispatch authorised: initiating human ${u.userId}; service ${si.id}; target ${targetId}; accountable owner ${si.ownerId}; expires ${si.expiresAt}.`});
 const checkpoint=await readState(db,s.organisation.id),current=scope(checkpoint,u.userId);
 if(checkpoint.operations?.serviceBindings?.[targetId]!==expected||current.version!==m.version||current.role!==m.role)fail(403,'Service or initiating human authority changed during audit. Nothing was sent.');
 await domain(checkpoint,current);
 assertTarget(s,checkpoint,targetId,context?.intent==='probe');
 requireServiceIdentity(checkpoint,expected!,kind,targetId);
 if(personId){const p=checkpoint.workspace.people.find(x=>x.id===personId);if(!p||!normallyAllowed(current,p,checkpoint.operations?.accessScope))fail(403,'Patient scope changed during audit. Nothing was sent.');}
 if(i&&!targetAvailable(checkpoint.workspace.integrations.find(x=>x.id===targetId),context?.intent==='probe'))fail(403,'Service target changed during audit. Nothing was sent.');
 async function domain(state:OrgState,member:Member){
  if(context){
   if(context.intent==='probe'&&!member.isOwner)fail(403,'Current owner access is required for a diagnostic probe.');
   if(member.version!==m.version||member.role!==m.role)fail(403,'Initiating human authority changed. Nothing was sent.');
   if(personId){const p=state.workspace.people.find(x=>x.id===personId);if(!p||!normallyAllowed(member,p,state.operations?.accessScope))fail(403,'Patient scope changed. Nothing was sent.');}
  }
  if(context?.intent!=='lookup'&&context){
   if(state.operations?.maintenance)fail(423,'Organisation paused for maintenance. Nothing was sent.');
   if(context.purpose&&!purposePermits(member,context.purpose,state.operations?.purposeGrants))fail(403,'Current purpose grant does not permit this request. Nothing was sent.');
  }
  await context?.authorize?.(state,member);
 }
}

function targetAvailable(i:OrgState['workspace']['integrations'][number]|undefined,probe=false){return !!i&&(i.status==='active'||(probe&&i.status==='suspended'&&i.mode==='http'&&((i.kind==='ehr'&&!!i.ehr)||(i.kind==='mis'&&!!i.mis))));}
function assertTarget(prepared:OrgState,current:OrgState,targetId:string,probe=false){
 const original=prepared.workspace.integrations.find(x=>x.id===targetId),target=current.workspace.integrations.find(x=>x.id===targetId);
 if(original&&(!target||target.version!==original.version||!targetAvailable(target,probe)||(probe&&target.status!==original.status)))fail(403,'Service connection configuration changed. Nothing was sent.');
 const agreement=(state:OrgState)=>targetId==='independent:anaemia'?state.operations?.anaemiaProvider:targetId.startsWith('frontline:')?frontlineAgreement(state,targetId.slice('frontline:'.length)):undefined;
 if(targetId.startsWith('frontline:')&&prepared.operations?.frontlineProviders?.[targetId.slice('frontline:'.length)]&&!current.operations?.frontlineProviders?.[targetId.slice('frontline:'.length)])fail(403,'Independent provider agreement removed. Nothing was sent.');
 const old=agreement(prepared),now=agreement(current);
 if(old&&(!now||!now.active||now.version!==old.version))fail(403,'Independent provider agreement changed. Nothing was sent.');
}
