import { identity, loadFor, json } from './server';
import { fail, person } from './core';
import { scope } from './store';
import { actionPlan } from './action-plan';
// Slice 4b: one patient's action plan. Loads only that patient's partition plus organisation documents.
export async function actionPlanRead(request:Request){
 const personId=new URL(request.url).searchParams.get('personId')??'';if(!personId||personId.length>200)fail(400,'Choose a patient.');
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation'),async()=>[personId]),m=scope(s,u.userId);
 if(m.role==='admin')fail(403,'Action plans contain patient information.');
 return json(actionPlan(s,m,person(s.workspace,personId)));
}
