import type { D1Database } from '@cloudflare/workers-types';
import { digest } from './core';
import { defaultOperations } from './operations';
import type { Release } from './indicator-differencing';
import { releaseCandidates, type Series } from './indicators';
// Slice 7g: the differencing ledger's storage, shared by the indicator queries (slice 6s/6w) and aggregate report
// delivery. Moved unchanged from indicators-server.ts so both paths write releases the same way: the ledger is a
// value inside the operations row, written by its own compare-and-swap statement (it moves no revision and writes
// no command receipt; commands that save the operations row keep the stored ledger, see store.ts KEEP_LEDGER).
//
// A release's receiver is hashed into `v`: a person viewing indicators is `viewer:<user id>`, a destination that
// receives an aggregate report is `destination:<integration id>`. Filters, series keys and group labels are hashed
// with the organisation in the salt, exactly as before.
export async function readLedger(db:D1Database,orgId:string):Promise<{ledger:Release[];text:string|null}>{
 const r=await db.prepare("SELECT json(json_extract(data,'$.indicatorReleases')) AS l, 1 AS present FROM operations WHERE org_id=?").bind(orgId).first<{l:string|null;present:number}>();
 if(!r)return {ledger:[],text:null};
 return {ledger:r.l?JSON.parse(r.l) as Release[]:[],text:r.l??''};
}
export async function writeLedger(db:D1Database,orgId:string,previous:string|null,next:Release[]){
 const value=JSON.stringify(next);
 if(previous===null){const r=await db.prepare('INSERT INTO operations (org_id,data) VALUES (?,?) ON CONFLICT(org_id) DO NOTHING').bind(orgId,JSON.stringify({...defaultOperations(),indicatorReleases:next})).run();return r.meta.changes===1;}
 const r=await db.prepare("UPDATE operations SET data=json_set(data,'$.indicatorReleases',json(?)) WHERE org_id=? AND COALESCE(json(json_extract(data,'$.indicatorReleases')),'')=?").bind(value,orgId,previous).run();
 return r.meta.changes===1;
}
export type Candidate={ids:string[];isCohort:boolean;release:Release};
// The salted hash used for every value a release records (filters, series keys, group labels, receivers).
export const ledgerHash=(orgId:string)=>async(x:string)=>(await digest(`saha-indicator-release:${orgId}:${x}`)).slice(0,20);
// Hashed candidate releases for one receiver and one query (filters team, village, programme). Since slice 6aa each
// release also records its measures, filters, exclusions, grouping, window and suppressed cells (indicators.ts
// releaseCandidates), so the indicator page and aggregate reports write releases in the same form.
export async function candidateReleases(orgId:string,receiver:string,q:{team?:string|null;village?:string|null;programme?:string|null},series:Series[],at:string):Promise<Candidate[]>{
 const h=ledgerHash(orgId);
 return (await releaseCandidates(series,q,await h(receiver),at,h)) as Candidate[];
}
