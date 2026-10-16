import { identity, loadFor, json } from './server';
import { fail } from './core';
import { scope } from './store';
import { packAt } from './programmes';
import { packChanges } from './programme-migration';
import { FACT_UNITS, MANIFEST_FORMAT, MAX_INSTALLATIONS, MAX_MANIFEST_CHARS, NOT_CLINICALLY_APPROVED, conflicts, rangeProtocolsOf, installationsOf, mayReadInstallations, mayReview, openEpisodesOn } from './pack-installation';
// Slice 4f: the organisation's programme pack installations, newest first, with the changes from each mapped earlier
// version, current conflicts for those not yet active, the count of open episodes pinned to each, and what the reader may
// do next. Owners and clinicians only. Pack definitions, staff ids and counts; no patient data.
export async function packInstallationRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 if(!mayReadInstallations(m))fail(403,'Only an organisation owner or a clinician can view programme pack installations.');
 const name=(id?:string)=>id?s.members.find(x=>x.userId===id)?.displayName??'Former member':null;
 const installations=[...installationsOf(s)].reverse().map(x=>({id:x.id,packId:x.packId,version:x.version,state:x.state,name:x.pack.name,programme:x.pack.programme,purpose:x.pack.purpose,manifestHash:x.manifestHash,
  questions:x.pack.questions,adoption:x.manifest.adoption??null,approvals:(x.approvals??[]).map(a=>({kind:a.kind,by:name(a.by),at:a.at,manifestHash:a.manifestHash,reference:a.reference})),schedule:x.pack.schedule??null,escalation:x.pack.escalation??null,escalationRules:x.manifest.escalation??[],migratesFrom:x.pack.migratesFrom??[],changeNote:x.pack.changeNote??null,
  stagedBy:name(x.stagedBy),stagedAt:x.stagedAt,reason:x.reason,review:x.review?{by:name(x.review.by),at:x.review.at,decision:x.review.decision,reason:x.review.reason}:null,activatedAt:x.activatedAt??null,retiredAt:x.retiredAt??null,
  history:x.history.map(h=>({state:h.state,at:h.at,by:name(h.by),reason:h.reason})),
  changes:(x.pack.migratesFrom??[]).map(v=>packAt(x.packId,v,s)).filter(p=>!!p).map(p=>packChanges(p!,x.pack)),
  conflicts:['staged','approved'].includes(x.state)?conflicts(s,x.pack,x.id,x.state==='approved'):[],openEpisodes:openEpisodesOn(s,x.packId,x.version),
  canApproveBuyer:['staged','approved'].includes(x.state)&&m.isOwner&&!(x.approvals??[]).some(a=>a.kind==='buyer'),canApproveClinical:['staged','approved'].includes(x.state)&&mayReview(m,x)&&!(x.approvals??[]).some(a=>a.kind==='clinical'),canApproveWorkflow:['staged','approved'].includes(x.state)&&m.isOwner&&!(x.approvals??[]).some(a=>a.kind==='workflow'),canReview:['staged','approved'].includes(x.state)&&mayReview(m,x),canActivate:m.isOwner&&x.state==='approved',canRetire:m.isOwner&&['staged','approved','active'].includes(x.state),uploadedByYou:x.stagedBy===u.userId}));
 return json({notice:NOT_CLINICALLY_APPROVED,format:MANIFEST_FORMAT,limits:{manifestCharacters:MAX_MANIFEST_CHARS,installations:MAX_INSTALLATIONS},factUnits:FACT_UNITS,canStage:m.isOwner,installations,generatedAt:new Date().toISOString()});
}

export async function rangeProtocolRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 if(!mayReadInstallations(m))fail(403,'Only an organisation owner or a clinician can view value range publications.');
 return json({notice:'Compiled engineering examples only. Independent review checks governance; clinical approval is pending. Population examples may be activated only in synthetic or training environments. Existing captures stay pinned.',canStage:!!m.isOwner,protocols:[...rangeProtocolsOf(s)].reverse().map(x=>({...x,canReview:['staged','approved'].includes(x.state)&&m.role==='clinician'&&m.userId!==x.stagedBy,canActivate:m.isOwner&&x.state==='approved',canRetire:m.isOwner&&['staged','approved','active'].includes(x.state)}))});
}
