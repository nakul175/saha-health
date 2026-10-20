import type {D1Database} from '@cloudflare/workers-types';
import {fail} from './core';
import {deviceDiagnosticRows, type DeviceDiagnostic} from './exceptions';
import type {Member,OrgState} from './types';

const CODES=new Set<DeviceDiagnostic['code']>(['storage-quota','storage-write','crypto-unavailable','sync-transport','sync-refused','purge-write']);
type Row={id:string;actor_id:string;at:string;data:string};
const parse=(row:Row):DeviceDiagnostic|null=>{try{const d=JSON.parse(row.data);return CODES.has(d.code)&&Number.isInteger(d.draftCount)&&d.draftCount>=0&&d.draftCount<=200&&Number.isInteger(d.pendingCount)&&d.pendingCount>=0&&d.pendingCount<=200?{id:row.id,actorId:row.actor_id,at:row.at,code:d.code,draftCount:d.draftCount,pendingCount:d.pendingCount}:null;}catch{return null;}};

// The device table contains redacted fixed codes and bounded counts only. Limit the read so malformed or very large
// histories cannot make opening Operations unbounded; the main queue remains capped independently at 500 rows.
export async function readDeviceDiagnosticReports(db:D1Database,s:OrgState){
 const result=await db.prepare("SELECT id,actor_id,at,data FROM device_work_events WHERE org_id=? AND kind='report' ORDER BY at DESC,id DESC LIMIT 1000").bind(s.organisation.id).all<Row>();
 return result.results.map(parse).filter((x):x is DeviceDiagnostic=>!!x);
}
export async function readDeviceDiagnosticRows(db:D1Database,s:OrgState,m:Member,now=new Date().toISOString()){
 return deviceDiagnosticRows(s,m,await readDeviceDiagnosticReports(db,s),now);
}

export async function authorizeDeviceDiagnosticReplay(db:D1Database,s:OrgState,m:Member,itemId:string){
 if(!itemId.startsWith('device-diagnostic:'))return;const id=itemId.slice('device-diagnostic:'.length);if(!id)fail(403,'This device diagnostic is outside your current scope.');
 const row=await db.prepare("SELECT id,actor_id,at,data FROM device_work_events WHERE org_id=? AND id=? AND kind='report'").bind(s.organisation.id,id).first<Row>();
 if(!row||!parse(row)||!deviceDiagnosticRows(s,m,[parse(row)!]).length)fail(403,'This device diagnostic is outside your current scope.');
}
