import {checkSourceCommand,verifiedSourceDocument} from './clinical-source';
import {db} from './server';
import { identity, loadFor, json, runtime } from './server';
import { allowed } from './access';
import { scope } from './store';
import { visit, person } from './core';
import { providers, AGENT_VERSION } from './agent';
import { governanceState, entryScope, entryIssues, activeEntry, governanceManager, protocolPreview } from './governance';
import { CORPUS_VERSION } from './evaluation';
import { currentFields, shadowManager, shadowReport, shadowsOf } from './shadow';
import { DRIFT_NOTICE, driftReport } from './drift';
import { capabilityHistories, capabilityImpact, capabilityUsage, lifecycleStage, replacementOf, requiredAction } from './capability-lifecycle';
export async function governanceRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId),g=governanceState(s),visitId=new URL(request.url).searchParams.get('visitId');
  const patients=s.workspace.people.filter(p=>allowed(m,p)),permitted=new Set(patients.map(p=>p.id)),scoped=s.workspace.visits.filter(v=>permitted.has(v.personId));
 // Slice 5d: lifecycle stage, replacement, use by version (counts, managers only) and in-progress work in scope once a capability is unusable.
 const unavailableDocuments=new Set<string>();for(const e of g.entries)if(e.spec.kind==='source'&&e.spec.document&&entryScope(m,e)){try{await verifiedSourceDocument(db(),s.organisation.id,e);}catch{unavailableDocuments.add(e.id);}}
 const entries=g.entries.filter(e=>entryScope(m,e)&&(m.role!=='asha'||e.state==='active')).map(e=>{const documentUnavailable=unavailableDocuments.has(e.id)||e.spec.kind==='protocol'&&e.spec.sourceIds.some(id=>unavailableDocuments.has(id)),usable=activeEntry(s,e)&&!documentUnavailable,capability=e.spec.kind==='capability';return {...e,issues:[...entryIssues(s,e),...(documentUnavailable?['Acquired source document unavailable or integrity changed']:[])],usable,lifecycle:lifecycleStage(s,e),replacedByRevision:replacementOf(s,e)?.revision??null,...(capability&&governanceManager(m)?{usage:capabilityUsage(s.workspace.visits,e)}:{}),...(capability&&!usable?{impact:capabilityImpact(scoped,e).counts}:{})};}),ids=new Set(entries.map(e=>e.id)),unusable=new Set(entries.filter(e=>!e.usable).map(e=>e.id));
 const safety=g.safety.filter(c=>permitted.has(c.personId)).map(c=>({...c,personName:patients.find(p=>p.id===c.personId)?.name,ownerAvailable:s.members.some(o=>o.userId===c.ownerId&&o.role==='clinician'&&allowed(o,patients.find(p=>p.id===c.personId)!))}));
 if(visitId){await checkSourceCommand(db(),s,{type:'checkProtocol',visitId},m);const v=visit(s.workspace,visitId),p=person(s.workspace,v.personId);
  // SAHA-100: retain reviewed directory entries when they become stale or are
  // suspended so the worker can see that a previously known destination is
  // unavailable. Drafts stay private to governance managers and retired
  // revisions stay in governance history; neither is offered for referral.
  // The command path still re-checks the exact version and current usability.
  const services=g.entries.filter(e=>e.spec.kind==='service'&&e.spec.teamIds.includes(p.teamId)&&entryScope(m,e)&&!!e.review&&['active','suspended'].includes(e.state)).map(e=>({
   ...e,issues:[...entryIssues(s,e),...(e.state==='suspended'?['Service availability suspended']:[])],usable:activeEntry(s,e)
  })).sort((a,b)=>Number(b.usable)-Number(a.usable)||a.spec.title.localeCompare(b.spec.title));
  return json({preview:await protocolPreview(s,m,v),checks:await Promise.all((v.protocolChecks??[]).map(async c=>{const actor=s.members.find(a=>a.userId===c.by&&a.version===c.byVersion&&allowed(a,p));return {...c,reviewable:!!actor&&(await protocolPreview(s,actor,v)).contextHash===c.contextHash}})),services,safety:safety.filter(c=>c.visitId===visitId),canReview:m.role==='clinician',governanceEntries:entries.filter(e=>['protocol','capability'].includes(e.spec.kind)&&e.spec.teamIds.includes(p.teamId))});}
 return json({entries,evaluations:g.evaluations.filter(e=>ids.has(e.entryId)),safety,providers:providers(s.workspace.integrations,runtime()),agentVersion:AGENT_VERSION,corpusVersion:CORPUS_VERSION,canAuthor:governanceManager(m),canReview:m.role==='clinician',canActivate:m.isOwner,canShadow:shadowManager(m),
  // Slice 5g: provider and model history per capability key in the viewer's scope, for governance managers.
  capabilityHistory:governanceManager(m)?capabilityHistories(s,new Set(entries.filter(e=>e.spec.kind==='capability').map(e=>e.spec.key))).map(h=>({...h,revisions:h.revisions.filter(r=>ids.has(r.entryId))})):[],
  // Slice 5f: shadow comparisons, counts only, to owners and clinician governance managers within the capability's scope.
  shadows:shadowManager(m)?shadowsOf(s).filter(x=>ids.has(x.entryId)).map(x=>shadowReport(s,x)):[],
  // Slice 5i: drift of shadow agreement across consecutive 7-day periods, counts only, same visibility as shadows.
  drift:shadowManager(m)?{notice:DRIFT_NOTICE,rows:driftReport(s,shadowsOf(s).filter(x=>ids.has(x.entryId)),undefined,(r,sh)=>currentFields(s,r,sh))}:null,clinicalDeployment:false,affected:s.workspace.visits.filter(v=>permitted.has(v.personId)).flatMap(v=>[...(v.agentRuns??[]).filter(r=>r.governance&&ids.has(r.governance.id)).map(r=>({entryId:r.governance!.id,visitId:v.id,personId:v.personId,personName:patients.find(p=>p.id===v.personId)?.name,kind:'agent',state:r.status,runId:r.id,action:unusable.has(r.governance!.id)?requiredAction(v,r):null})),...(v.protocolChecks??[]).flatMap(c=>c.protocols.filter(p=>ids.has(p.id)).map(p=>({entryId:p.id,visitId:v.id,personId:v.personId,personName:patients.find(p=>p.id===v.personId)?.name,kind:'protocol',state:c.decision?.decision??'unreviewed'})))]),scope:'Synthetic evaluation and workflow rehearsal. Local reviews do not establish clinical approval or production readiness.'});
}
