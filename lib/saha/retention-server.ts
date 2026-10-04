import { identity, loadFor, json, db } from './server';
import { scope } from './store';
import { retentionReview, yearsAgo } from './retention';
// Slice 6c: retention schedule, holds and eligibility counts for organisation owners.
// Slice 14f: also the disposal plans, and which held patients have since been disposed (from the disposal register).
export async function retentionRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId),now=new Date().toISOString();
 const rule=s.retention?.policies.at(-1)?.rules.find(r=>r.recordClass==='audit-event');
 const total=await db().prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=?').bind(s.organisation.id).first<{n:number}>();
 const past=rule?await db().prepare('SELECT count(*) AS n FROM audit_events WHERE org_id=? AND at<?').bind(s.organisation.id,yearsAgo(now,rule.years)).first<{n:number}>():null;
 const missing=[...new Set((s.retention?.holds??[]).map(h=>h.personId).filter((id):id is string=>!!id&&!s.workspace.people.some(p=>p.id===id)))].slice(0,90);
 const disposed=missing.length?(await db().prepare(`SELECT record_id FROM disposals WHERE org_id=? AND table_name='patients' AND record_id IN (${missing.map(()=>'?').join(',')})`).bind(s.organisation.id,...missing).all<{record_id:string}>()).results.map(r=>r.record_id):[];
 return json(retentionReview(s,m,{total:total?.n??0,pastSchedule:past?.n??0},now,new Set(disposed)));
}
