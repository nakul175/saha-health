import { identity, loadFor, json } from './server';
import { fail, person } from './core';
import { scope } from './store';
import { abdmView } from './abdm';
// Slice 7a: one patient's ABHA link, consent artefacts and an optional consent check (partition load).
export async function abdmRead(request:Request){
 const u=await identity(),p=new URL(request.url).searchParams,personId=p.get('personId')??'';
 if(!personId||personId.length>200)fail(422,'Choose a person.');
 const s=await loadFor(u,request.headers.get('x-saha-organisation'),async()=>[personId]),m=scope(s,u.userId);if(m.role==='admin')fail(403,'Patient access is required.');
 const date=p.get('date');if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))fail(422,'Use a YYYY-MM-DD date.');
 return json(abdmView(s,person(s.workspace,personId),{consentId:p.get('consentId'),hiType:p.get('hiType'),date,purpose:p.get('purpose')}));
}
