import { z } from 'zod';
import { digest, fail, uuid } from './core';
import { allowed, normallyAllowed } from './access';
import { environmentOf } from './environment';
import { csvBytes, importsInto, MAX_CSV, MAX_ROWS, mayImport, parseCsv } from './patient-import';
import { adoptedVersion, catalogueOf, enrollableAt } from './programmes';
import { VISIT_COLUMNS, VISIT_REFUSED, applyVisitRows, fileDigest, mayImportVisits, planVisitRows } from './visit-import';
import type { Member, OrgState, Person } from './types';
import type { Actor } from './store';
// Slice 2h: controlled import of programme enrolments and external identifiers for existing people (BR-DATA-11), on
// the slice 2f pattern. The same importers (an owner or supervisor with a clinician or supervisor role, or a
// supervision delegate, for teams they belong to) dry-run a CSV; the dry run resolves each row's person by a Saha
// record id or an exact external identifier written issuer:value, classifies the row as accepted or rejected with
// reasons, and returns row numbers, record ids, versions, counts and reasons only (never names or identifier values)
// under a plan hash. Apply recomputes the dry run, accepts only that exact plan, changes the accepted records (one
// revision each) and writes one counted audit event. Slice 10i adds kind `visits` (historical visits with clinical content, imported
// as confirmed visits marked IMPORTED; lib/saha/visit-import.ts) on the same dry run, plan hash and apply, for owners and clinicians.
export const RECORD_IMPORT='record-import-v1';
export const KINDS=['enrolments','identifiers','visits'] as const;
export type ImportKind=typeof KINDS[number];
export const COLUMNS:Record<ImportKind,readonly string[]>={enrolments:['person','pack','version','episode_label','start_date'],identifiers:['person','issuer','identifier'],visits:VISIT_COLUMNS};
// Known issuers and their formats. Illustrative: the formats are not validated against the issuing registries.
// ABHA numbers and addresses are linked through the ABHA verification flow (slice 7a), never imported.
export const KNOWN_ISSUERS:Record<string,{label:string;pattern:RegExp;format:string}>={
 rch:{label:'RCH ID',pattern:/^\d{12}$/,format:'An RCH ID is 12 digits.'},
 nikshay:{label:'Ni-kshay ID',pattern:/^\d{6,10}$/,format:'A Ni-kshay ID is 6 to 10 digits.'},
};
export const REFUSED_ISSUERS=['abha','abha_address','abha-address'];
// Slice 6aa (seventh review, finding 5): issuers are an allowlist (KNOWN_ISSUERS); a value shaped like an ABHA number
// (14 digits, optionally grouped 2-4-4-4) or an issuer code naming ABHA or a health id is refused under any issuer, so
// ABHA verification and organisation-wide ABHA uniqueness cannot be skipped by naming the issuer differently.
export const ABHA_LIKE_VALUE=/^\d{2}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$/;
export const ABHA_LIKE_ISSUER=/abha|health|hid|phr/;
const ISSUER=/^[a-z][a-z0-9_-]{1,31}$/,VALUE=/^[A-Za-z0-9][A-Za-z0-9/._-]{0,63}$/;
const reason=z.string().trim().min(10,'Explain the reason in at least 10 characters.').max(500);
const tooLarge=`The file is larger than ${MAX_CSV.toLocaleString('en-IN')} bytes. Split it into smaller batches.`;
const csv=z.string().min(1,'Paste or choose a CSV file.').max(MAX_CSV,tooLarge).refine(x=>csvBytes(x)<=MAX_CSV,tooLarge);
export const recordImportInput=z.object({kind:z.enum(KINDS),csv}).strict();
export const recordImportSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('recordImportApply'),kind:z.enum(KINDS),csv,planHash:z.string().regex(/^[0-9a-f]{64}$/),reason}).strict(),
]);
export type RecordRow={row:number;status:'accepted'|'rejected';reasons:string[];personId?:string;version?:number;conflict?:{personId:string;version:number};duplicateOf?:{visitId:string}};
type Accepted={row:number;personId:string}&({kind:'enrolments';packId:string;packVersion:number;episodeLabel:string;startDate:string|null}|{kind:'identifiers';issuer:string;value:string});
const NO_RECORD='No record in the teams you may import into matches this person.';
const live=(p:Person)=>!p.mergedInto;
// Resolve a row's person: a Saha record id, or issuer:value naming an identifier already recorded on one record.
// Not found and outside the importer's teams answer the same neutral reason, so the dry run is not an existence oracle.
export function resolvePerson(s:OrgState,m:Member,ref:string,now:string,inScope:(p:Person)=>boolean=p=>allowed(m,p,now)&&importsInto(s,m,p.teamId,now)):{person?:Person;reason?:string}{
 const text=ref.trim();if(!text)return {reason:'Person is required: a Saha record id or an identifier written issuer:value.'};
 let found:Person[];const at=text.indexOf(':');
 if(at>0){const issuer=text.slice(0,at).trim().toLowerCase(),value=text.slice(at+1).trim();found=s.workspace.people.filter(p=>live(p)&&(p.identifiers??[]).some(i=>i.issuer===issuer&&i.value===value));}
 else found=s.workspace.people.filter(p=>p.id===text);
 const mine=found.filter(inScope);
 if(found.length!==1||mine.length!==1)return {reason:NO_RECORD};
 if(mine[0].mergedInto)return {person:mine[0],reason:'This record was merged into another record. Use the surviving record.'};
 return {person:mine[0]};
}
const header=(kind:ImportKind,table:string[][])=>{
 const cols=COLUMNS[kind],h=table[0].map(x=>x.trim().toLowerCase()),missing=cols.filter(c=>!h.includes(c)),extra=h.filter(x=>!cols.includes(x));
 if(missing.length||extra.length||new Set(h).size!==h.length)fail(422,`The header must name exactly these columns once each: ${cols.join(', ')}.${missing.length?` Missing: ${missing.join(', ')}.`:''}${extra.length?` Not recognised: ${extra.length} column${extra.length===1?'':'s'}.`:''}`);
 return h;
};
const today=(now:string)=>now.slice(0,10);
const validDate=(x:string)=>/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x))&&new Date(x).toISOString().slice(0,10)===x;
export async function planRecordImport(s:OrgState,m:Member,kind:ImportKind,text:string,envName:string,now=new Date().toISOString()){
 if(!(kind==='visits'?mayImportVisits(m):mayImport(s,m,now)))fail(403,kind==='visits'?VISIT_REFUSED:'Only an owner or supervisor with a clinician or supervisor role can import, for teams they belong to.');
 const table=parseCsv(text);if(!table.length)fail(422,'The CSV is empty.');const h=header(kind,table);
 const body=table.slice(1);if(!body.length)fail(422,'The CSV has a header but no rows.');if(body.length>MAX_ROWS)fail(422,`At most ${MAX_ROWS} rows per import; this file has ${body.length}.`);
 if(kind==='visits'){
  // Slice 10i: visits are resolved within the importer's normal care scope only (no emergency access, no owner widening).
  const plan=await planVisitRows(s,m,h,body,envName,now,await fileDigest(text),ref=>resolvePerson(s,m,ref,now,p=>normallyAllowed(m,p)&&m.teamIds.includes(p.teamId)));
  return {import:RECORD_IMPORT,kind,environment:envName,counts:plan.counts,rows:plan.rows as RecordRow[],planHash:plan.planHash,accepted:plan.accepted,fileDigest:plan.fileDigest,notice:plan.notice};
 }
 const col=(r:string[],c:string)=>(r[h.indexOf(c)]??'').trim();
 const rows:RecordRow[]=[],accepted:Accepted[]=[],teams=new Set<string>();
 for(const [n,r] of body.entries()){
  const row=n+1,reasons:string[]=[];let conflict:RecordRow['conflict'];
  if(r.length!==h.length)reasons.push(`Row ${row} has ${r.length} fields; the header has ${h.length}.`);
  const who=resolvePerson(s,m,col(r,'person'),now),p=who.person;if(who.reason)reasons.push(who.reason);if(p)teams.add(p.teamId);
  let item:Accepted|null=null;
  if(kind==='enrolments'){
   const packId=col(r,'pack').toLowerCase(),versionText=col(r,'version'),label=col(r,'episode_label'),start=col(r,'start_date');
   let version=0;
   if(!catalogueOf(s).some(x=>x.id===packId))reasons.push('Programme pack is not in this organisation\'s catalogue.');
   else if(!versionText){version=adoptedVersion(s,packId);if(!version)reasons.push('This programme pack cannot open new episodes.');}
   else if(!/^\d{1,4}$/.test(versionText)||!enrollableAt(packId,Number(versionText),s))reasons.push('Pack version must be a compiled or activated version of this pack, or left empty for the adopted version.');
   else version=Number(versionText);
   if(label.length<3||label.length>200)reasons.push('Episode label is required, 3 to 200 characters.');
   if(start&&!validDate(start))reasons.push('Start date must be a date written YYYY-MM-DD, or left empty.');else if(start&&start>today(now))reasons.push('Start date cannot be in the future.');
   if(p&&!p.mergedInto&&version&&(p.enrolments??[]).some(e=>e.packId===packId&&e.state==='active'))reasons.push('This record already has an open episode of this pack.');
   const earlier=p?accepted.find(a=>a.kind==='enrolments'&&a.personId===p.id&&a.packId===packId):undefined;if(earlier)reasons.push(`Row ${earlier.row} in this file already opens this pack for this record.`);
   if(!reasons.length&&p)item={kind,row,personId:p.id,packId,packVersion:version,episodeLabel:label,startDate:start||null};
  }else{
   const issuer=col(r,'issuer').toLowerCase(),value=col(r,'identifier');
   if(REFUSED_ISSUERS.includes(issuer)||ABHA_LIKE_ISSUER.test(issuer)||ABHA_LIKE_VALUE.test(value))reasons.push('ABHA numbers and addresses are linked through ABHA verification, not imported.');
   else if(!ISSUER.test(issuer))reasons.push('Issuer must be a short lower-case code such as rch or nikshay.');
   if(!VALUE.test(value))reasons.push('Identifier must be 1 to 64 letters, digits or the characters / . _ - and start with a letter or digit.');
   else if(Object.hasOwn(KNOWN_ISSUERS,issuer)&&!KNOWN_ISSUERS[issuer].pattern.test(value))reasons.push(KNOWN_ISSUERS[issuer].format);
   if(ISSUER.test(issuer)&&!reasons.some(x=>x.startsWith('ABHA'))&&!Object.hasOwn(KNOWN_ISSUERS,issuer))reasons.push(`Issuer must be one of: ${Object.keys(KNOWN_ISSUERS).join(', ')}. Other issuers are not imported.`);
   if(p&&!p.mergedInto&&Object.hasOwn(KNOWN_ISSUERS,issuer)&&VALUE.test(value)&&!ABHA_LIKE_VALUE.test(value)){
    const own=(p.identifiers??[]).filter(i=>i.issuer===issuer);
    if(own.some(i=>i.value===value))reasons.push('This identifier is already recorded on this record.');
    else if(own.length)reasons.push('This record already has a different identifier from this issuer; an import does not replace it.');
    // Organisation-wide, as slice 6u checks ABHA: a record outside the importer's scope is never named.
    const other=s.workspace.people.find(o=>o.id!==p.id&&live(o)&&(o.identifiers??[]).some(i=>i.issuer===issuer&&i.value===value));
    if(other){if(allowed(m,other,now)){reasons.push('This identifier is already recorded on another record you can see. Review whether the records are the same person.');conflict={personId:other.id,version:other.version};}
     else reasons.push('This identifier cannot be recorded here. Ask an identity steward to review before importing it.');}
   }
   const same=accepted.find(a=>a.kind==='identifiers'&&a.issuer===issuer&&a.value===value);if(same)reasons.push(`Row ${same.row} in this file already carries this identifier.`);
   const twice=p?accepted.find(a=>a.kind==='identifiers'&&a.personId===p.id&&a.issuer===issuer&&a.value!==value):undefined;if(twice)reasons.push(`Row ${twice.row} in this file already gives this record an identifier from this issuer.`);
   if(!reasons.length&&p)item={kind,row,personId:p.id,issuer,value};
  }
  const ids=p?{personId:p.id,version:p.version}:{};
  if(item){accepted.push(item);rows.push({row,status:'accepted',reasons:[],...ids});}
  else rows.push({row,status:'rejected',reasons,...ids,...(conflict?{conflict}:{})});
 }
 // Bound to the rows as parsed and classified and to every permitted record in the teams of the matched records.
 const records=s.workspace.people.filter(p=>teams.has(p.teamId)&&allowed(m,p,now)).map(p=>[p.id,p.version]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 const planHash=await digest({import:RECORD_IMPORT,kind,environment:envName,importer:m.userId,rows:rows.map(r=>[r.row,r.status,r.personId??null,r.version??null,r.conflict??null,r.reasons]),accepted,records});
 const counts={rows:rows.length,accepted:accepted.length,rejected:rows.length-accepted.length};
 return {import:RECORD_IMPORT,kind,environment:envName,counts,rows,planHash,accepted,notice:'Row numbers, record ids, versions, counts and reasons only. Rejected rows are never applied.'};
}
// The dry run as returned over HTTP: the parsed rows (labels and identifier values) stay on the server.
export const publicRecordPlan=({accepted,...plan}:Awaited<ReturnType<typeof planRecordImport>>)=>plan;
export function authorizeRecordImport(s:OrgState,m:Member,c:any){if(c?.type!=='recordImportApply')return;if(c.kind==='visits'){if(!mayImportVisits(m))fail(403,VISIT_REFUSED);return;}if(!mayImport(s,m))fail(403,'Only an owner or supervisor with a clinician or supervisor role can import, for teams they belong to.');}
export async function applyRecordImport(s:OrgState,input:unknown,u:Actor,m:Member,env:Record<string,string|undefined>,now=new Date().toISOString()):Promise<any|null>{
 const parsed=recordImportSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeRecordImport(s,m,c);
 const e=environmentOf(env);if(e.name==='misconfigured')fail(409,'The environment is not configured correctly. Imports are refused until it is corrected.');
 const plan=await planRecordImport(s,m,c.kind,c.csv,e.name,now);
 if(plan.planHash!==c.planHash)fail(409,'The file or the records changed since the dry run. Run the dry run again and review it before applying.');
 if(!plan.accepted.length)fail(409,'The dry run has no rows to apply.');
 if(c.kind==='visits')return applyVisitRows(s,plan as Awaited<ReturnType<typeof planVisitRows>>,c.reason,u,m,now);
 const batchId=uuid(),people=new Set<string>(),w=s.workspace,lineage=(row:number)=>({batchId,row,planHash:plan.planHash});
 for(const a of plan.accepted){
  if(a.kind==='visits')continue;
  const p=w.people.find(x=>x.id===a.personId)!;importsInto(s,m,p.teamId,now,true);people.add(p.id);
  if(a.kind==='enrolments'){
   const pack=enrollableAt(a.packId,a.packVersion,s)!;p.enrolments??=[];p.followUps??=[];
   p.enrolments.push({id:uuid(),packId:pack.id,packVersion:pack.version,state:'active',episodeLabel:a.episodeLabel,startDate:a.startDate,createdAt:now,createdBy:u.userId,registration:'not_submitted',imported:{...lineage(a.row),at:now,by:u.userId}});
   if(!p.programmes.includes(pack.programme))p.programmes.push(pack.programme);
   for(const v of w.visits.filter(v=>v.personId===p.id))if(v.plan&&v.plan.state!=='completed')v.plan.state='blocked';
  }else{p.identifiers??=[];p.identifiers.push({issuer:a.issuer,value:a.value,verified:false,recordedAt:now,recordedBy:u.userId,source:'import',imported:lineage(a.row)});}
 }
 const k=plan.counts,what=c.kind==='enrolments'?'episodes opened (official registration not submitted)':'identifiers recorded (not verified with the issuer)';
 w.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:s.organisation.id,detail:`Import ${RECORD_IMPORT} (${c.kind}) batch ${batchId} applied from dry run ${plan.planHash}: ${k.rows} rows, ${plan.accepted.length} ${what} on ${people.size} record${people.size===1?'':'s'}, ${k.rejected} rejected. Reason: ${c.reason}`});
 // Counts and row numbers only: a replay by key returns no record ids.
 return {batchId,kind:c.kind,counts:{...k,applied:plan.accepted.length,records:people.size},rows:plan.accepted.map(a=>a.row)};
}
