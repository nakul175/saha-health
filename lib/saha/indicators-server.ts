import { identity, loadFor, json } from './server';
import { fail } from './core';
import { scope } from './store';
import { catalogue, GROUPS, indicatorQuery, interpret, manager, MIN_CELL, type Group } from './indicators';
// Slice 6d: catalogue, governed interpretation of a question, and scoped indicator queries.
export async function indicatorsRead(request:Request){
 const u=await identity(),url=new URL(request.url),p=url.searchParams;
 const s=await loadFor(u,request.headers.get('x-saha-organisation'),undefined,true),m=scope(s,u.userId);manager(m);
 const question=p.get('question');
 if(question!==null){if(question.length>300)fail(422,'Keep the question under 300 characters.');return json({interpretation:interpret(question)});}
 const ids=(p.get('ids')??'').split(',').map(x=>x.trim()).filter(Boolean);
 if(!ids.length)return json({catalogue:catalogue(),groups:GROUPS,minimumCell:MIN_CELL,teams:s.teams.filter(t=>m.teamIds.includes(t.id)).map(t=>({id:t.id,name:t.name})),villages:[...new Set(s.workspace.people.filter(x=>x.assigned).map(x=>x.village))].sort(),programmes:[...new Set(s.workspace.people.filter(x=>x.assigned).flatMap(x=>x.programmes))].sort()});
 const text=(k:string)=>{const v=p.get(k);if(v&&v.length>200)fail(422,'Filter value too long.');return v||null;};
 return json(indicatorQuery(s,m,{ids,days:Number(p.get('days')??30),group:(p.get('group')??'none') as Group,team:text('team'),village:text('village'),programme:text('programme')}));
}
