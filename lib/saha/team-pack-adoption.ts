import {transitionVerified} from './installed-transition-authority';
import {adoptedVersion,enrollableAt} from './programmes';
import type {OrgState} from './types';
// A published team adoption remains historical after its reviewer leaves. Current
// enrolment/import permissions still apply; retiring its exact target fails closed.
export function adoptedVersionForTeam(s:OrgState,id:string,teamId:string,at=new Date().toISOString()){
 const ops=s.operations as any,entries=(ops?.teamPackAdoptions??[]).filter((a:any)=>a.teamId===teamId&&a.packId===id&&Date.parse(a.at)<=Date.parse(at));
 const a=entries.at(-1);if(!a)return adoptedVersion(s,id);
 const t=(ops.installedTransitions??[]).find((t:any)=>t.id===a.transitionId&&t.state==='applied'&&t.hash===a.declarationHash&&t.teamId===teamId&&t.reviewer&&t.reviewer!==t.proposer&&t.history.some((h:any)=>h.id===a.eventId&&h.kind==='applied'));
 const applied=t?.history.find((h:any)=>h.id===a.eventId&&h.kind==='applied');const p=enrollableAt(id,a.version,s);return t&&applied?.at===a.at&&applied?.by===a.by&&t.toId===a.installationId&&t.toHash===a.manifestHash&&transitionVerified(s,t)&&p?.installed?.installationId===a.installationId&&p?.installed?.manifestHash===a.manifestHash?a.version:0;
}
