import { z } from 'zod';
import { fail } from './core';
import { dueTransfers, MAX_TRANSFER, MAX_TRANSFERS, type CaseloadTransfer } from './caseload';
import type { OrgState } from './types';
const ref=z.string().min(1).max(200),version=z.number().int().positive(),status=z.enum(['scheduled','held','applied','cancelled']);
const item=z.object({id:ref,version,state:status,teamId:ref,fromUserId:ref,toUserId:ref,personIds:z.array(ref).min(1).max(MAX_TRANSFER).refine(x=>new Set(x).size===x.length),effectiveAt:z.string().datetime(),createdAt:z.string().datetime(),createdBy:z.string().min(1),reason:z.string().min(1)}).passthrough();
const rows=z.array(z.object({id:ref,version,state:status,team_id:ref,data:z.string()}).strict()).max(MAX_TRANSFERS);
export const SELECTIVE_REUSE_TRANSFER_SQL='SELECT id,version,state,team_id,data FROM caseload_transfers WHERE org_id=? ORDER BY id LIMIT 501';
// Individually reused original due predicate: reads cannot bootstrap or apply a
// scheduler. A known pending queue must be resolved before the global writer.
export function selectiveReuseTransferProof(source:unknown,now:string,dispatch=false){
 const parsed=rows.safeParse(source);if(!parsed.success)fail(503,'Current assignment context is unavailable.');let transfers:CaseloadTransfer[];
 try{transfers=parsed.data.map(row=>{const t=item.parse(JSON.parse(row.data));if(t.id!==row.id||t.version!==row.version||t.state!==row.state||t.teamId!==row.team_id||new Date(t.effectiveAt).toISOString()!==t.effectiveAt||new Date(t.createdAt).toISOString()!==t.createdAt)throw Error('Unbound assignment.');return t as CaseloadTransfer;});}catch{fail(503,'Current assignment context is unavailable.');}
 if(transfers.some(t=>t.state==='held')||dueTransfers({caseloads:transfers}as OrgState,now).length)fail(409,'Resolve due or held assignments through the existing authority workflow before reopening selective reuse.');
 const refreshAt=transfers.filter(t=>t.state==='scheduled').map(t=>t.effectiveAt).sort()[0]??null;
 if(dispatch&&refreshAt)fail(409,'An assignment transfer is pending. Resolve it before applying a selective reuse command.');
 return {refreshAt,fingerprint:JSON.stringify(parsed.data)};
}
