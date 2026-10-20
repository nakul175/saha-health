import { identity, loadFor, json, db } from './server';
import { digest, fail } from './core';
import { scope } from './store';
import { exceptionalView } from './exceptional';
import { accessRoute, recordAccesses } from './access-audit';
// Slice 6a: the viewer's emergency-access grants and the grants they may review.
export async function exceptionalRead(request:Request){
 const u=await identity(),org=request.headers.get('x-saha-organisation'),s=await loadFor(u,org),m=scope(s,u.userId),now=new Date().toISOString();
 if(m.role==='admin')fail(403,'Patient access is required.');
 const view=exceptionalView(s,m,now),rows=[...view.mine.map(x=>({kind:'own grant',row:x})),...view.reviews.map(x=>({kind:'pending review',row:x})),...view.reviewed.map(x=>({kind:'completed review',row:x}))];
 await recordAccesses(db(),s,u,m,rows.length?rows.map(({kind,row})=>{const p=s.workspace.people.find(x=>x.id===row.personId)!;return {action:'viewRecordHistory' as const,subject:row.grantId,personId:row.personId,detail:`Emergency-access register read: ${kind}; status ${row.active?'active':'ended'}; patient name, grant reason and review state shown.${accessRoute(m,p,now)}`};}):[{action:'viewRecordHistory',subject:s.organisation.id,personId:null,detail:'Emergency-access register read: no own, pending-review or completed-review grants returned.'}],now);
 // The audit commit is also an authority checkpoint. Re-read before disclosure so a concurrent grant, review or
 // membership change cannot return a queue assembled under stale authority.
 const fresh=await loadFor(u,s.organisation.id),fm=scope(fresh,u.userId);
 if(fm.role==='admin')fail(403,'Patient access is required.');
 const current=exceptionalView(fresh,fm,now);
 if(await digest(current)!==await digest(view))fail(409,'Emergency access changed while the register was opening. Refresh and try again.');
 return json(current);
}
