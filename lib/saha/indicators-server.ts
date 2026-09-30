import { identity, loadFor, json } from './server';
import { fail } from './core';
import { boundedJsonBody } from './request-body';
import { scope } from './store';
import { catalogue, GROUPS, indicatorQuery, interpret, manager, MIN_CELL, type Group } from './indicators';
// Slice 6d: catalogue, governed interpretation of a question, and scoped indicator queries.
export async function indicatorsRead(request:Request){return indicatorsFor(request,new URL(request.url).searchParams);}
// Slice 6l: the workspace posts questions and filters in a JSON body, so free text and village
// names stay out of request URLs (and so out of platform request logs). GET remains for compatibility.
export async function indicatorsPost(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)fail(403,'Cross-origin requests are not allowed.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this request.');
 const body=await boundedJsonBody(request,4000);if(!body||typeof body!=='object'||Array.isArray(body))fail(422,'Send the indicator request as an object.');
 const p=new URLSearchParams();for(const [k,v] of Object.entries(body as Record<string,unknown>)){if(typeof v==='string'||typeof v==='number')p.set(k,String(v));else if(v!==null)fail(422,'Indicator fields must be text or numbers.');}
 return indicatorsFor(request,p);
}
async function indicatorsFor(request:Request,p:URLSearchParams){
 const u=await identity();
 const s=await loadFor(u,request.headers.get('x-saha-organisation'),undefined,true),m=scope(s,u.userId);manager(m);
 const question=p.get('question');
 if(question!==null){if(question.length>300)fail(422,'Keep the question under 300 characters.');return json({interpretation:interpret(question)});}
 const ids=(p.get('ids')??'').split(',').map(x=>x.trim()).filter(Boolean);
 if(!ids.length)return json({catalogue:catalogue(),groups:GROUPS,minimumCell:MIN_CELL,teams:s.teams.filter(t=>m.teamIds.includes(t.id)).map(t=>({id:t.id,name:t.name})),villages:[...new Set(s.workspace.people.filter(x=>x.assigned).map(x=>x.village))].sort(),programmes:[...new Set(s.workspace.people.filter(x=>x.assigned).flatMap(x=>x.programmes))].sort()});
 const text=(k:string)=>{const v=p.get(k);if(v&&v.length>200)fail(422,'Filter value too long.');return v||null;};
 return json(indicatorQuery(s,m,{ids,days:Number(p.get('days')??30),group:(p.get('group')??'none') as Group,team:text('team'),village:text('village'),programme:text('programme')}));
}
