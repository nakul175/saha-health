import {digest} from './core';
import type {OrgState} from './types';
import type {D1Database} from '@cloudflare/workers-types';
// This capability is never serialized. Operations/patient JSON alone cannot grant it.
const verified=new WeakMap<OrgState,Set<string>>();
const cohorts=new WeakMap<OrgState,Map<string,string[]>>();
export const transitionOriginalCohort=(s:OrgState,t:any)=>transitionVerified(s,t)?cohorts.get(s)?.get(t.id)??[]:[];
const effects=new WeakMap<OrgState,Map<string,any[]>>();
export function transitionEffectVerified(s:OrgState,t:any,marker:any,taskId:string){return transitionVerified(s,t)&&effects.get(s)?.get(t.id)?.some(e=>e.personId===marker.personId&&e.teamId===marker.teamId&&e.originalId===taskId&&e.replacementId===marker.replacementId&&e.originalHash===marker.originalHash&&e.eventId===marker.eventId)===true;}
export function transitionReplacementVerified(s:OrgState,task:any,personId:string){const o=task.transitionOrigin;if(!o)return false;const t=((s.operations as any)?.installedTransitions??[]).find((t:any)=>t.id===o.transitionId);return !!t&&transitionVerified(s,t)&&o.personId===personId&&o.teamId===t.teamId&&o.declarationHash===t.hash&&o.installationId===t.toId&&o.manifestHash===t.toHash&&effects.get(s)?.get(t.id)?.some(e=>e.personId===personId&&e.replacementId===task.id&&e.originalId===o.originalId&&e.originalHash===o.originalHash&&e.eventId===o.eventId&&e.sourceOccurrenceId===o.sourceOccurrenceId)===true;}
export const transitionVerified=(s:OrgState,t:any)=>verified.get(s)?.has(JSON.stringify(t))??false;
export const transitionDeclaration=(t:any)=>({format:'saha-installed-transition-v1',fromId:t.fromId,fromHash:t.fromHash,toId:t.toId,toHash:t.toHash,teamId:t.teamId,effectiveAt:t.effectiveAt,schedule:t.schedule,mapping:t.mapping,proposer:t.proposer,proposerVersion:t.proposerVersion});
export async function hydrateTransitionAuthority(db:D1Database,s:OrgState){
 const transitions=(s.operations as any)?.installedTransitions??[],trusted=new Set<string>();verified.set(s,trusted);effects.set(s,new Map());cohorts.set(s,new Map());
 if(!transitions.length)return; // Ordinary legacy states need no new table.
 if(transitions.length>100)return;
 let rows:any[];try{rows=(await db.prepare('SELECT id,transition_id,actor_id,kind,at,data FROM installed_pack_transition_events WHERE org_id=? ORDER BY rowid LIMIT 2001').bind(s.organisation.id).all()).results;}catch{return;} // Missing/invalid authority never grants adoption.
 if(rows.length>2000)return;
 for(const t of transitions){try{
  if(Object.keys(t).some(k=>!['id','version','hash','fromId','fromHash','toId','toHash','teamId','effectiveAt','schedule','mapping','state','proposer','proposerVersion','reviewer','reviewerVersion','reviewedImpactHash','history','applyEventId','appliedEffects','appliedPersonIds'].includes(k)))continue;
  if(t.hash!==await digest(transitionDeclaration(t))||t.version!==t.history.length||!['staged','approved','rejected','applied'].includes(t.state))continue;
  const kinds=t.history.map((h:any)=>h.kind);if(kinds[0]!=='staged'||kinds.at(-1)!==t.state||kinds.slice(1,-1).some((k:string)=>k!=='approved')||t.history.length>20)continue;
  if(t.state!=='staged'&&(!t.reviewer||t.reviewer===t.proposer||!Number.isInteger(t.reviewerVersion)))continue;
  let okay=true,lastReview:any=null;
  for(let index=0;index<t.history.length;index++){const h=t.history[index],row=rows.find(r=>r.id===h.id&&r.transition_id===t.id),v=row?JSON.parse(row.data):null;
   if(!v||row.actor_id!==h.by||row.kind!==h.kind||row.at!==h.at||JSON.stringify(v.event)!==JSON.stringify(h)||JSON.stringify(v.declaration)!==JSON.stringify(transitionDeclaration(t))||v.hash!==t.hash||v.version!==index+1||v.state!==h.kind||JSON.stringify(v.history)!==JSON.stringify(t.history.slice(0,index+1))){okay=false;break;}
   if(index===0){if(h.by!==t.proposer){okay=false;break;}}
   else if(['approved','rejected'].includes(h.kind)){if(h.by!==v.reviewer||v.reviewer===t.proposer||!Number.isInteger(v.reviewerVersion)||!h.planHash||!v.reviewedImpactHash){okay=false;break;}lastReview=v;}
   else if(h.kind==='applied'){if(index!==t.history.length-1||!lastReview||Date.parse(h.at)<Date.parse(t.effectiveAt)||v.applier!==h.by||!h.planHash||v.reviewedImpactHash!==lastReview.reviewedImpactHash||v.reviewer!==lastReview.reviewer||v.reviewerVersion!==lastReview.reviewerVersion){okay=false;break;}}
   else{okay=false;break;}
  }
  if(t.state!=='staged'&&(!lastReview||lastReview.reviewer!==t.reviewer||lastReview.reviewerVersion!==t.reviewerVersion||lastReview.reviewedImpactHash!==t.reviewedImpactHash))okay=false;
  if(okay&&t.state==='applied'){const v=JSON.parse(rows.find(r=>r.id===t.history.at(-1).id).data);if(JSON.stringify(v.effects??[])!==JSON.stringify(t.appliedEffects??[])||JSON.stringify(v.personIds??[])!==JSON.stringify(t.appliedPersonIds??[])||t.applyEventId!==t.history.at(-1).id)okay=false;else{cohorts.get(s)!.set(t.id,v.personIds??[]);const own=[];for(const e of v.effects??[]){const p=s.workspace.people.find(p=>p.id===e.personId),task=p?.followUps?.find(f=>f.id===e.originalId),marker=(task as any)?.transitionSupersessions?.find((m:any)=>m.eventId===e.eventId);if(marker&&await digest(JSON.parse(marker.originalBody))===e.originalHash)own.push(e);}effects.get(s)!.set(t.id,own);}}if(okay)trusted.add(JSON.stringify(t));
 }catch{/* Malformed retained provenance grants nothing. */}}
}
