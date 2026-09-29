import { identity, loadFor, json, db } from './server';
import { fail, person } from './core';
import { scope } from './store';
import { householdView, PURPOSES, type Purpose } from './household';
// Slice 1: worker-facing household view and sharing preview. Loads only the household's members.
export async function householdRead(request:Request){
 const u=await identity(),url=new URL(request.url),personId=url.searchParams.get('personId')??'',recipient=url.searchParams.get('recipient'),purpose=(url.searchParams.get('purpose')??'care-coordination') as Purpose;
 if(!personId||personId.length>100||(recipient&&recipient.length>100))fail(422,'Choose a person.');
 if(!PURPOSES.includes(purpose))fail(422,'Choose a sharing purpose.');
 const s=await loadFor(u,request.headers.get('x-saha-organisation'),async orgId=>{
  const row=await db().prepare("SELECT json_extract(data,'$.householdId') AS h FROM patients WHERE org_id=? AND id=?").bind(orgId,personId).first<{h:string|null}>();
  if(!row?.h)return [personId];
  const h=await db().prepare('SELECT data FROM households WHERE org_id=? AND id=?').bind(orgId,row.h).first<{data:string}>();
  const members=h?(JSON.parse(h.data).members as {personId:string;to?:string}[]).filter(x=>!x.to).map(x=>x.personId):[];
  return [...new Set([personId,...members])].slice(0,40);
 });
 const m=scope(s,u.userId);if(m.role==='admin')fail(403,'Patient access is required.');
 return json(householdView(s,m,person(s.workspace,personId),recipient,purpose));
}
