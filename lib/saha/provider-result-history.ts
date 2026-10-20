import type { AIResult } from './types';

export type ProviderResultHistoryRow={
 id:string;provider:string;model:string;integrationVersion:number|null;contractVersion:string|null;
 status:AIResult['status'];originalOutput:string;createdAt:string;observedAt:string[];inputHash:string;
 outputHash:string|null;reviewState:'unreviewed'|'reviewed';reviewedAt:string|null;legacy:boolean;
};

/** Read-only chronology. Missing legacy custody is exposed, never inferred from today's provider. */
export function providerResultHistory(results:readonly AIResult[]):ProviderResultHistoryRow[]{
 return results.map(r=>({
  id:r.id,provider:r.providerSnapshot?.name??r.providerName,model:r.providerSnapshot?.model??'not retained',
  integrationVersion:r.providerSnapshot?.integrationVersion??null,contractVersion:r.providerSnapshot?.contractVersion??null,
  status:r.status,originalOutput:r.outputSnapshot?.original??r.text,createdAt:r.createdAt,
  observedAt:[...(r.inputSnapshot?.observedAt??[])],inputHash:r.inputSnapshot?.hash??r.inputHash,
  outputHash:r.outputSnapshot?.hash??null,reviewState:r.review?.state??(r.reviewed?'reviewed':'unreviewed'),
  reviewedAt:r.review?.at??null,legacy:!r.providerSnapshot||!r.inputSnapshot||!r.outputSnapshot
 })).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}

/** Juxtaposition metadata only: it deliberately produces no winner, equivalence or clinical conclusion. */
export function independentComparison(results:readonly AIResult[]){
 const rows=providerResultHistory(results);
 return {rows,providers:[...new Set(rows.map(r=>`${r.provider} · ${r.model}`))],comparable:false as const,selected:null,clinicalUse:false as const};
}
