import { identity, loadFor, json, db } from './server';
import { scope } from './store';
import { ACCESS_ACTION_NAMES } from './types';
import { assembleTrace, EXECUTION_ACTIONS, parseTraceQuery, traceLookups, traceTarget, type TraceAuditRow, type TraceReceiptRow } from './trace';
// Slice 6y: read-only trace of one visit, programme submission or EHR publication for the viewer.
// Not a material read under slice 6t: it returns ids, states, times and command types, no clinical content.
const CHUNK=40;
const chunks=<T,>(xs:T[])=>{const out:T[][]=[];for(let i=0;i<xs.length;i+=CHUNK)out.push(xs.slice(i,i+CHUNK));return out;};
export async function traceRead(request:Request){
 const u=await identity(),q=parseTraceQuery(new URL(request.url).searchParams),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 const now=new Date().toISOString(),t=traceTarget(s,m,q,now),l=traceLookups(s,t,now),d=db(),orgId=s.organisation.id,cols='id,at,actor_name,role,action,subject,seq';
 const audit=new Map<string,TraceAuditRow>(),add=(rows:TraceAuditRow[])=>{for(const r of rows)audit.set(r.id,r);};
 // Every event looked up here is linked to the patient (indexed by organisation, patient and time).
 const marks=(n:number)=>Array(n).fill('?').join(',');
 // Subjects and ids are queried in chunks so a visit with many items stays under D1's bound-parameter limit.
 for(const part of chunks(l.subjects))add((await d.prepare(`SELECT ${cols} FROM audit_events WHERE org_id=? AND person_id=? AND action IN (${marks(EXECUTION_ACTIONS.length)}) AND subject IN (${marks(part.length)}) ORDER BY at LIMIT 300`).bind(orgId,l.personId,...EXECUTION_ACTIONS,...part).all<TraceAuditRow>()).results);
 if(l.access&&l.visitId)add((await d.prepare(`SELECT ${cols} FROM audit_events WHERE org_id=? AND person_id=? AND action IN (${marks(ACCESS_ACTION_NAMES.length)}) AND (subject=? OR instr(detail,?)>0) ORDER BY at LIMIT 200`).bind(orgId,l.personId,...ACCESS_ACTION_NAMES,l.visitId,l.visitId).all<TraceAuditRow>()).results);
 for(const ids of chunks(l.auditIds))add((await d.prepare(`SELECT ${cols} FROM audit_events WHERE org_id=? AND person_id=? AND id IN (${marks(ids.length)})`).bind(orgId,l.personId,...ids).all<TraceAuditRow>()).results);
 const receipts:TraceReceiptRow[]=[];
 for(const part of chunks(l.receipts))receipts.push(...(await d.prepare(`SELECT actor_id,key,created_at FROM command_receipts WHERE org_id=? AND (${part.map(()=>'(actor_id=? AND key=?)').join(' OR ')})`).bind(orgId,...part.flatMap(r=>[r.actorId,r.key])).all<TraceReceiptRow>()).results);
 return json(assembleTrace(s,m,t,[...audit.values()],receipts,now));
}
