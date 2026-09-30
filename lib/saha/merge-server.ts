import { identity, loadFor, json, db } from './server';
import { fail } from './core';
import { scope } from './store';
import { mergeView } from './merge';
// Slice 1c: merge cases for one person. Loads the person and every record named in their cases.
export async function mergeRead(request:Request){
 const u=await identity(),personId=new URL(request.url).searchParams.get('personId')??'';
 if(!personId||personId.length>200)fail(422,'Choose a person.');
 const s=await loadFor(u,request.headers.get('x-saha-organisation'),async orgId=>{
  const rows=await db().prepare('SELECT survivor_id,duplicate_id FROM identity_cases WHERE org_id=? AND (survivor_id=? OR duplicate_id=?) LIMIT 200').bind(orgId,personId,personId).all<{survivor_id:string;duplicate_id:string}>();
  return [...new Set([personId,...rows.results.flatMap(r=>[r.survivor_id,r.duplicate_id])])];
 });
 const m=scope(s,u.userId);if(m.role==='admin')fail(403,'Patient access is required.');
 return json(mergeView(s,m,personId));
}
