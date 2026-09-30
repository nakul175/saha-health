import { identity, loadFor, json, db } from './server';
import { scope } from './store';
import { retentionReview, yearsAgo } from './retention';
// Slice 6c: retention schedule, holds and eligibility counts for organisation owners.
export async function retentionRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId),now=new Date().toISOString();
 const rule=s.retention?.policies.at(-1)?.rules.find(r=>r.recordClass==='audit-event');
 const total=await db().prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=?').bind(s.organisation.id).first<{n:number}>();
 const past=rule?await db().prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND at<?').bind(s.organisation.id,yearsAgo(now,rule.years)).first<{n:number}>():null;
 return json(retentionReview(s,m,{total:total?.n??0,pastSchedule:past?.n??0},now));
}
