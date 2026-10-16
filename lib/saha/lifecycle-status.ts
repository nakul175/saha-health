import type { CorrectionTask, Submission, Visit } from './types';

export type DestinationLifecycle = { id:string; name:string; state:Submission['state']; receipt:string|null;
  recovery:string|null; correctionTaskId:string|null };
export type VisitLifecycle = {
  local:'not-started'|'draft'|'confirmed'|'cancelled'|'corrected';
  server:'not-saved'|'saved'; review:'not-started'|'awaiting-review'|'complete';
  service:'not-complete'|'locally-complete'|'cancelled-locally'; device:'not-claimed';
  destinations:DestinationLifecycle[]; unresolved:number;
};

const openTask=(visit:Visit,submissionId:string)=>visit.correctionTasks?.find(task=>task.state==='open'&&
  task.output.kind==='programme-submission'&&task.output.refId===submissionId);
function recoveryFor(submission:Submission,task?:CorrectionTask):string|null{
 if(task)return task.instruction;
 if(submission.state==='accepted')return 'The destination already accepted this record. Use the authorised correction or reversal workflow; the receipt remains history.';
 if(submission.state==='uncertain'||submission.state==='sending')return 'Look up the original destination receipt before any retry or correction.';
 if(submission.state==='rejected')return 'Correct the local record, review a new plan and submit it as new authorised work.';
 if(submission.state==='queued'||submission.state==='retryable')return 'Cancel this confirmed-unsent delivery or finish it with the original key; do not create a second attempt.';
 return null;
}

/** Read-only projection: local state never becomes a destination acknowledgement. */
export function visitLifecycle(visit:Visit|null,submissions:Submission[]):VisitLifecycle{
 if(!visit)return {local:'not-started',server:'not-saved',review:'not-started',service:'not-complete',device:'not-claimed',destinations:[],unresolved:0};
 const cancelled=Boolean(visit.voidedAt),corrected=Boolean(visit.supersededBy);
 const destinations=submissions.filter(item=>item.visitId===visit.id).map(item=>{const task=openTask(visit,item.id);return {
  id:item.id,name:item.connectorName,state:item.state,receipt:item.receipt??null,recovery:recoveryFor(item,task),correctionTaskId:task?.id??null};});
 return {local:cancelled?'cancelled':corrected?'corrected':visit.state,server:'saved',review:visit.state==='draft'?'awaiting-review':'complete',
  service:cancelled||corrected?'cancelled-locally':visit.state==='confirmed'?'locally-complete':'not-complete',device:'not-claimed',destinations,
  unresolved:destinations.filter(item=>['uncertain','sending','queued','retryable'].includes(item.state)||item.correctionTaskId).length};
}
