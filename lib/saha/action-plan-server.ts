import { db, identity, loadFor, json } from './server';
import { fail, person } from './core';
import { scope } from './store';
import { actionPlan } from './action-plan';
import { recordPatientWorkView } from './read-audit';
// Slice 4b: one patient's action plan. Loads only that patient's partition plus organisation documents.
export async function actionPlanRead(request:Request){
 const personId=new URL(request.url).searchParams.get('personId')??'';if(!personId||personId.length>200)fail(400,'Choose a patient.');
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'),async()=>[personId]),m=scope(s,u.userId);
 if(m.role==='admin')fail(403,'Action plans contain patient information.');
 const p=person(s.workspace,personId),result=actionPlan(s,m,p);
 await recordPatientWorkView(db(),s,u,m,'action plan',1,p);
 return json(result);
}
