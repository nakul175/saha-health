import { z } from 'zod';
import { identity, loadFor, db, json } from './server';
import { digest, fail } from './core';
import { scope } from './store';
import { recordAccesses } from './access-audit';
import { boundedJsonBody } from './request-body';
import { reconciliationQueue } from './reconciliation';

const querySchema=z.object({personId:z.string().trim().min(1).max(200).optional(),cursor:z.string().regex(/^[a-f0-9]{64}:\d{1,6}$/).optional(),mine:z.boolean().optional()}).strict();
export async function reconciliationRead(request:Request){
 const origin=request.headers.get('origin');if((origin&&origin!==new URL(request.url).origin)||request.headers.get('sec-fetch-site')==='cross-site')fail(403,'Cross-site requests are not allowed.');
 const u=await identity();if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this operation.');
 const parsed=querySchema.safeParse(await boundedJsonBody(request,2000));if(!parsed.success)fail(422,'Choose a valid reconciliation view.');
 const s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 const all=reconciliationQueue(s,m,parsed.data.personId),rows=parsed.data.mine?all.filter(x=>x.ownerId===u.userId):all;
 const basis=await digest(rows.map(x=>[x.kind,x.parentId,x.taskId,x.assignmentHistory.length,x.ownerId,x.newAssignment]));
 const [prior,offset]=parsed.data.cursor?.split(':')??[],reset=!!prior&&prior!==basis,start=prior===basis?Number(offset):0;
 const page=rows.slice(start,start+50),next=start+50<rows.length?`${basis}:${start+50}`:null;
 const ids=[...new Set(page.map(x=>x.personId))];
 // Audit before returning any task or assignment details. Merge rows expose information about
 // both records, so both are audited; neither is included unless both remain in current scope.
 for(const row of page)if(row.kind==='identity-merge'){const k=s.identityCases!.find(x=>x.id===row.parentId)!;for(const id of [k.survivorId,k.duplicateId])if(!ids.includes(id))ids.push(id);}
 await recordAccesses(db(),s,u,m,ids.length?ids.map(id=>({action:'viewRecordHistory' as const,subject:id,personId:id,detail:'Scoped reconciliation queue read; current assignments and downstream obligations only.'})):[{action:'viewRecordHistory',subject:s.organisation.id,detail:'Scoped reconciliation queue read; no patient tasks returned.'}]);
 return json({rows:page,total:rows.length,next,reset,newAssignments:rows.filter(x=>x.newAssignment).length,scope:'Current care scope; identity-merge details require access to both records. No output is sent or corrected from this queue.'});
}
