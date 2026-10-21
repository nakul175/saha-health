import { followUpOpen } from './programmes';
import type { OrgState, Person, PlanItemRef } from './types';

const terminal=new Set(['completed','declined','cancelled']);
const key=(r:PlanItemRef)=>`${r.kind}:${r.id}`;
function open(s:OrgState,p:Person,r:PlanItemRef){
 if(r.kind==='follow-up')return p.followUps?.some(x=>x.id===r.id&&followUpOpen(s,x))??false;
 if(r.kind==='referral')return s.workspace.referrals.some(x=>x.id===r.id&&x.personId===p.id&&!terminal.has(x.state));
 return s.workspace.visits.some(v=>v.personId===p.id&&v.protocolChecks?.some(x=>x.id===r.id&&!x.decision));
}
// A dependency suppresses only the dependent item's reminder/escalation while an actual blocker is still open.
// The item remains open in workload and handover counts; no clinical work is completed or hidden.
export function planItemWaiting(s:OrgState,p:Person,dependent:PlanItemRef){return (p.planDependencies??[]).some(d=>!d.removed&&key(d.dependent)===key(dependent)&&open(s,p,d.blocker));}
