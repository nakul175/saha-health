import type { Submission } from './types';

export type DestinationRecovery = 'none' | 'send' | 'lookup' | 'prepare-new-plan';
export type DestinationOutcome = Pick<Submission, 'id' | 'connectorId' | 'connectorName' | 'state' | 'receipt' | 'attempts'> & { recovery: DestinationRecovery };
export type PartialCompletion = { state: 'complete' | 'partial' | 'outstanding' | 'closed'; accepted: number; outstanding: number; closed: number; destinations: DestinationOutcome[] };

/** Summarise a multi-destination action without collapsing its independent receipts. */
export function partialCompletion(submissions: readonly Submission[]): PartialCompletion {
 const destinations=submissions.map((submission):DestinationOutcome=>({id:submission.id,connectorId:submission.connectorId,connectorName:submission.connectorName,state:submission.state,receipt:submission.receipt,attempts:submission.attempts,recovery:['queued','retryable'].includes(submission.state)?'send':['sending','uncertain'].includes(submission.state)?'lookup':['rejected','cancelled'].includes(submission.state)?'prepare-new-plan':'none'}));
 const accepted=destinations.filter(x=>x.state==='accepted').length,outstanding=destinations.filter(x=>['queued','retryable','sending','uncertain'].includes(x.state)).length,closed=destinations.length-accepted-outstanding;
 return {state:accepted===destinations.length&&destinations.length>0?'complete':accepted>0&&accepted<destinations.length?'partial':outstanding>0?'outstanding':'closed',accepted,outstanding,closed,destinations};
}
