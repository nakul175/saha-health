import { db, identity, loadFor, json } from './server';
import { fail } from './core';
import { scope } from './store';
import { workerActivity, type Correction } from './worker-activity';
// Slice 4c: per-worker activity evidence for the teams the viewer supervises. Who corrected a visit,
// when and why comes from the record revisions written by every correction.
export async function workerActivityRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'));const m=scope(s,u.userId);
 const days=Number(new URL(request.url).searchParams.get('days')??30);if(![7,30,90].includes(days))fail(422,'Choose 7, 30 or 90 days.');
 const since=new Date(Date.now()-(days+1)*86400000).toISOString();
 const rows=await db().prepare("SELECT entity_id,action,actor_name,reason,created_at FROM record_revisions WHERE org_id=? AND entity_type='visit' AND action IN ('amendVisit','voidVisit') AND created_at>=? ORDER BY created_at LIMIT 5000").bind(s.organisation.id,since).all<{entity_id:string;action:'amendVisit'|'voidVisit';actor_name:string;reason:string;created_at:string}>();
 const corrections:Correction[]=rows.results.map(r=>({visitId:r.entity_id,action:r.action,actorName:r.actor_name,reason:r.reason,at:r.created_at}));
 return json(workerActivity(s,m,days,corrections));
}
