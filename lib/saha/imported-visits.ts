import { fail } from './core';
import { isImported, type OrgState } from './types';
// Slice 10i: an imported visit (lib/saha/visit-import.ts) is confirmed historical content from another system. It is read-only
// history: it is never sent to a programme destination, referred, published to a health record or care context, summarised
// by an assistant, protocol-checked, reviewed, signed off, disputed or corrected as if it were recorded in Saha, and it is not counted in
// indicators, reports, pilot measures, shadow comparisons or freshness as a Saha visit. Integration of slices 10g and 10i: the sign-off withdrawal and dispute commands of 10g are refused too, because an imported
// visit cannot be signed off and a dispute ends in a correction. Every command that would turn it into
// something current names the visit by id, so one check on the server refuses them all. Marking it wrong-patient stays possible
// (a correction that appends evidence), and the record history shows the import.
export const IMPORTED_REFUSAL='This visit was imported from another system. It is read-only history: it cannot be sent, referred, published, checked, summarised, reviewed, signed off or corrected. Record a new visit for current observations, or mark it wrong-patient if it was imported for the wrong person.';
export const BLOCKED_ON_IMPORTED=new Set(['preparePlan','approvePlan','executePlan','runAI','reviewAI','createReferral','createDirectoryReferral','amendVisit','prepareEhrPublish','abdmCareContextLink','checkProtocol','reviewProtocol','saveClinicalConcern','saveProgrammeAnswers','verifyFact','verifyEntry','signOffVisit','confirmUnusualValue','prepareAgent','executeAgent','applyAgent','reviewAgentResult','outreachRecord','linkReferralSource','decideReferralRequest','withdrawSignOff','raiseDispute','resolveDispute','reuseFact']);
// Commands that name a visit and stay possible for an imported one: marking it wrong-patient (a correction that appends evidence),
// a safety report about it, and commands that act on records an imported visit cannot have (it is confirmed, so it cannot be saved or
// confirmed again; it has no assistant runs and no correction tasks). A contract test requires every command naming a visit to be
// in one of the two sets, so a new visit command has to be classified before it ships.
export const ALLOWED_ON_IMPORTED=new Set(['voidVisit','reportSafety','saveVisit','confirmVisit','cancelAgent','closeTimedOutAgent','closeCorrectionTask']);
export function ensureNotImported(s:OrgState,c:any){
 if(!BLOCKED_ON_IMPORTED.has(c?.type))return;
 const ids=[c.visitId,...(Array.isArray(c.visitIds)?c.visitIds:[]),c.type==='linkReferralSource'&&c.kind==='visit'?c.sourceId:undefined].filter((x):x is string=>typeof x==='string');
 if(ids.some(id=>isImported(s.workspace.visits.find(v=>v.id===id))))fail(409,IMPORTED_REFUSAL);
}
