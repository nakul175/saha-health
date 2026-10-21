type DynamicValue = ReturnType<typeof JSON.parse>;

import {db,identity,json,loadFor} from './server';
import {fail} from './core';
import {scope} from './store';
import {normallyAllowed} from './access';
import {activeSupportGrant,cases,redactedCase} from './support-case';
import {recordAggregateView} from './read-audit';
import {recordAccess} from './access-audit';

const allowedQuery=new Set(['caseId','content']);
const visibleCases=(state:Awaited<ReturnType<typeof loadFor>>,member:ReturnType<typeof scope>,userId:string)=>cases(state).filter(item=>{
 if(member.role==='admin')return true;
 const person=state.workspace.people.find(candidate=>candidate.id===item.personId);
 return !!person&&normallyAllowed(member,person)&&(member.isOwner||item.requesterId===userId);
});
export async function supportCaseRead(request:Request){
 const u=await identity(),url=new URL(request.url);if([...url.searchParams.keys()].some(k=>!allowedQuery.has(k))||url.searchParams.getAll('caseId').length>1||url.searchParams.getAll('content').length>1)fail(422,'Use one support case selector.');
 const selected=url.searchParams.get('caseId'),content=url.searchParams.get('content')==='1';if(content&&!selected)fail(422,'Choose the support case whose approved content is needed.');if(url.searchParams.has('content')&&!['0','1'].includes(url.searchParams.get('content')!))fail(422,'Choose content=0 or content=1.');
 const initial=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(initial,u.userId);if(!['admin','asha','clinician'].includes(m.role)&&!m.isOwner)fail(403,'Current support access required.');
 if(!content){
  const rows=visibleCases(initial,m,u.userId).filter(c=>!selected||c.id===selected).sort((a,b)=>b.reportedAt.localeCompare(a.reportedAt)).slice(0,100).map(c=>redactedCase(initial,c,m));
  if(selected&&!rows.length)fail(404,'Support case unavailable.');await recordAggregateView(db(),initial,u,m,'support cases',`${rows.length} redacted support case${rows.length===1?'':'s'} returned; fixed diagnostics only; no patient names, identifiers or facts.`);
  const fresh=await loadFor(u,initial.organisation.id),fm=scope(fresh,u.userId),freshRows=visibleCases(fresh,fm,u.userId).filter(c=>!selected||c.id===selected).sort((a,b)=>b.reportedAt.localeCompare(a.reportedAt)).slice(0,100).map(c=>redactedCase(fresh,c,fm));if(fm.role!==m.role||fm.isOwner!==m.isOwner||fm.version!==m.version)fail(403,'Support authority changed. Refresh.');if(JSON.stringify(freshRows)!==JSON.stringify(rows))fail(409,'Support cases changed during the read. Refresh.');
  return json({rows,canRequest:m.role==='admin',canDecide:m.isOwner&&m.role!=='admin'});
 }
 const item=cases(initial).find(c=>c.id===selected);if(!item)fail(404,'Support case unavailable.');const grant=activeSupportGrant(initial,item,m);if(!grant)fail(403,'An active approved support grant is required.');const p=initial.workspace.people.find(x=>x.id===item.personId),v=initial.workspace.visits.find(x=>x.id===item.visitId&&x.personId===item.personId);if(!p||!v)fail(409,'The support case record is unavailable.');
 const value:DynamicValue={caseId:item.id,grant:{id:grant.id,purpose:grant.purpose,scopes:grant.scopes,expiresAt:grant.expiresAt},content:{}};
 if(grant.scopes.includes('identity'))value.content.identity={name:p.name,age:p.age,sex:p.sex,village:p.village,programmes:p.programmes};
 if(grant.scopes.includes('visit-status'))value.content.visitStatus={state:v.state,createdAt:v.createdAt,confirmedAt:v.confirmedAt??null,version:v.version,recordVersion:v.recordVersion};
 if(grant.scopes.includes('visit-facts'))value.content.visitFacts=structuredClone(v.facts);
 const caseVersion=item.version,personVersion=p.version,visitVersion=v.version,recordVersion=v.recordVersion;
 await recordAccess(db(),initial,u,m,{action:'viewPatientRecord',subject:item.id,personId:p.id,detail:`Exceptional support content read for case ${item.id}; grant ${grant.id}; scopes ${grant.scopes.join(', ')}; purpose recorded on grant; expires ${grant.expiresAt}.`});
 const fresh=await loadFor(u,initial.organisation.id),fm=scope(fresh,u.userId),fi=cases(fresh).find(c=>c.id===item.id),fg=fi&&activeSupportGrant(fresh,fi,fm),fp=fresh.workspace.people.find(x=>x.id===item.personId),fv=fresh.workspace.visits.find(x=>x.id===item.visitId&&x.personId===item.personId);if(!fg||fg.id!==grant.id||fm.version!==m.version||fm.role!==m.role)fail(403,'Support grant or authority ended during the read. Nothing was shown.');if(fi!.version!==caseVersion||fp?.version!==personVersion||fv?.version!==visitVersion||fv?.recordVersion!==recordVersion)fail(409,'Support case or record changed during the read. Nothing was shown.');
 return json(value);
}
