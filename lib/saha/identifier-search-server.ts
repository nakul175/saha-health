import { activeOrg, db, identity, json } from './server';
import { fail, uuid } from './core';
import { readState, scope, viewerScope } from './store';
import { applyDueCaseloads } from './caseload-schedule';
import { recordAccesses, accessRoute } from './access-audit';
import { boundedJsonBody } from './request-body';
import { checkSearch, findMatches, ISSUER_LABEL, NO_MATCH, overLimit, searchInput, SEARCH_LIMITED, SEARCH_LIMIT_HOUR, MISS_LIMIT_HOUR, MISS_LIMIT_DAY } from './identifier-search';
// Slice 10e: search people by one issuer identifier (ABHA number, or a programme identifier). A read by POST so the identifier
// travels in the request body, never in a URL or a log line. Exact, complete identifiers only; the search is confined to the
// searcher's own care scope (the same scope as every patient read) and cannot tell them whether a record outside it exists.
// A match is a material read: one audit event per matched record is written, in the audit chain, before the match is returned,
// and a search that finds nothing is recorded too (without a record) because it counts toward the searcher's rate limit. If the
// event cannot be written nothing is returned (slice 6t).
export async function identifierSearch(request:Request){
 const u=await identity(),origin=request.headers.get('origin');
 if(origin&&origin!==new URL(request.url).origin)fail(403,'Cross-origin requests are not allowed.');
 if(!request.headers.get('content-type')?.startsWith('application/json'))fail(415,'Use JSON for this operation.');
 const parsed=searchInput.safeParse(await boundedJsonBody(request,2000));if(!parsed.success)fail(422,'Name the issuer and give the complete identifier.');
 const {issuer,value}=checkSearch(parsed.data.issuer,parsed.data.identifier);
 const orgId=await activeOrg(u,request.headers.get('x-saha-organisation'));await applyDueCaseloads(db(),orgId,u.userId);
 // The searcher's role and care scope come first: an administrator has none, and a refused searcher learns nothing.
 const vs=await viewerScope(db(),orgId,u.userId);
 if(vs&&vs.sql==='0')fail(403,'Patient access is required to search by identifier.');
 const now=new Date().toISOString(),hourAgo=new Date(Date.parse(now)-3600000).toISOString(),dayAgo=new Date(Date.parse(now)-86400000).toISOString();
 // Rate limits read from the audit chain: searches in the last hour, and searches that found nothing in the last hour and day.
 const [h,mh,md]=await db().batch([
  db().prepare("SELECT COUNT(DISTINCT subject) AS n FROM audit_events WHERE org_id=? AND actor_id=? AND action IN ('identifierSearch','identifierSearchMiss') AND at>=?").bind(orgId,u.userId,hourAgo),
  db().prepare("SELECT COUNT(*) AS n FROM audit_events WHERE org_id=? AND actor_id=? AND action='identifierSearchMiss' AND at>=?").bind(orgId,u.userId,hourAgo),
  db().prepare("SELECT COUNT(*) AS n FROM audit_events WHERE org_id=? AND actor_id=? AND action='identifierSearchMiss' AND at>=?").bind(orgId,u.userId,dayAgo)]);
 const n=(r:{results:unknown[]})=>(r.results[0] as {n:number}|undefined)?.n??0;
 if(overLimit({hour:n(h),missHour:n(mh),missDay:n(md)}))fail(429,SEARCH_LIMITED);
 // Candidates inside the searcher's scope only (the same predicate as the workspace read), then the exact rule in code.
 const holds=issuer==='abha'?"json_extract(p.data,'$.abha.number')=? AND json_extract(p.data,'$.abha.state')='linked'":"instr(p.data,'\"identifiers\"')>0 AND EXISTS (SELECT 1 FROM json_each(p.data,'$.identifiers') i WHERE json_extract(i.value,'$.issuer')=? AND json_extract(i.value,'$.value')=?)";
 const rows=await db().prepare(`SELECT p.id,json_extract(p.data,'$.mergedInto.personId') AS survivor FROM patients p WHERE p.org_id=? AND ${vs?`${vs.sql} AND `:''}${holds} LIMIT 11`).bind(orgId,...(vs?.binds??[]),...(issuer==='abha'?[value]:[issuer,value])).all<{id:string;survivor:string|null}>();
 const ids=[...new Set(rows.results.flatMap(r=>[r.id,...(r.survivor?[r.survivor]:[])]))];
 const s=await readState(db(),orgId,ids,u.userId,true),m=scope(s,u.userId);
 if(m.role==='admin'||m.role==='provider')fail(403,'Patient access is required to search by identifier.');
 const matches=findMatches(s.workspace.people,m,issuer,value,now).slice(0,10),searchId=uuid(),label=ISSUER_LABEL[issuer];
 // Audit first (fail closed): the event names the issuer and the number of records returned, never the identifier value.
 if(matches.length){
  const people=new Map(s.workspace.people.map(p=>[p.id,p]));
  await recordAccesses(db(),s,u,m,matches.map(x=>({action:'identifierSearch' as const,subject:searchId,personId:x.personId,detail:`Searched by ${label}: ${matches.length} record${matches.length===1?'':'s'} in the searcher's care scope matched and this record was returned (name, age, sex, locality and the masked identifier).${accessRoute(m,people.get(x.personId)!,now)}`})),now);
 }else await recordAccesses(db(),s,u,m,[{action:'identifierSearchMiss',subject:searchId,personId:null,detail:`Searched by ${label}: no record in the searcher's care scope matched.`}],now);
 return json({issuer,label,matches,searched:'Exact, complete identifiers only, within your own care scope. A record outside your scope is never returned or counted.',...(matches.length?{}:{message:NO_MATCH}),limits:{perHour:SEARCH_LIMIT_HOUR,noMatchPerHour:MISS_LIMIT_HOUR,noMatchPerDay:MISS_LIMIT_DAY}});
}
