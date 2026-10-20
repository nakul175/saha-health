import type { ConformanceEvidence, Integration } from './types';

export type ConformanceStage={id:string;label:string;complete:boolean;evidence:string|null};

const present=(value:string|undefined)=>typeof value==='string'&&value.trim().length>0;

/** A display-only assessment. It never promotes evidence or activates a connector. */
export function conformanceAssessment(integration:Pick<Integration,'mode'|'status'|'conformance'>){
 const e:ConformanceEvidence=integration.conformance??{};
 const stages:ConformanceStage[]=[
  {id:'syntactic',label:'Syntactic validation',complete:!!e.syntactic&&present(e.syntactic.evidence),evidence:e.syntactic?.evidence??null},
  {id:'sandbox',label:'Sandbox success',complete:!!e.sandbox&&present(e.sandbox.evidence),evidence:e.sandbox?.evidence??null},
  {id:'security',label:'Security review',complete:!!e.securityReview&&present(e.securityReview.evidence),evidence:e.securityReview?.evidence??null},
  {id:'certification',label:'Partner certification',complete:!!e.partnerCertification&&present(e.partnerCertification.evidence),evidence:e.partnerCertification?.evidence??null},
  {id:'onboarding',label:'Production onboarding',complete:!!e.productionOnboarding&&present(e.productionOnboarding.evidence),evidence:e.productionOnboarding?.evidence??null},
  {id:'live',label:'Live operational acceptance',complete:!!e.liveAcceptance&&present(e.liveAcceptance.evidence),evidence:e.liveAcceptance?.evidence??null},
 ];
 const productionEvidence={
  credentials:!!e.credentials&&present(e.credentials.binding),
  ownerApproval:!!e.ownerApproval&&present(e.ownerApproval.ownerId)&&present(e.ownerApproval.evidence),
  endToEndTransaction:!!e.endToEndTransaction&&present(e.endToEndTransaction.receipt),
  supportResponsibility:!!e.supportResponsibility&&present(e.supportResponsibility.owner),
 };
 const productionLive=integration.mode==='http'&&integration.status==='active'&&stages.every(s=>s.complete)&&Object.values(productionEvidence).every(Boolean);
 const missing=[...stages.filter(s=>!s.complete).map(s=>s.label),...Object.entries(productionEvidence).filter(([,ok])=>!ok).map(([id])=>({credentials:'Production credentials',ownerApproval:'Owner approval',endToEndTransaction:'End-to-end transaction evidence',supportResponsibility:'Support responsibility'}[id]!))];
 return {stages,productionEvidence,productionLive,missing};
}
