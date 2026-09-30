import { z } from 'zod';
import { digest, fail, uuid } from './core';
import { allowed } from './access';
import { patientMatches, nearName, normalName } from './continuity';
import { supervises } from './delegation';
import { environmentOf, POLICY } from './environment';
import { PROGRAMMES, type Member, type OrgState, type Person, type Programme } from './types';
import type { Actor } from './store';
// Slice 2f: controlled patient import with a dry run (BR-DATA-11), following the roster (1d) and fixture migration (2d)
// patterns. An owner or supervisor (or a supervision delegate) with a care or supervisor role uploads a CSV of people
// for teams they belong to and may manage. The dry run classifies each row as accepted, rejected with a reason, or a
// possible duplicate (the registration matcher over the importer's permitted records, and earlier rows of the same
// file). It returns row numbers, ids, versions, counts and reasons only, never names, under a plan hash bound to the
// rows and to the id and version of every permitted record in the named teams. Apply recomputes the dry run and
// accepts only that exact plan; it creates the accepted rows with a revision each and one counted audit event.
export const IMPORT='patient-import-v1';
export const MAX_CSV=16000,MAX_ROWS=100;
export const COLUMNS=['name','age','sex','village','programme','team'] as const;
const SEXES=['Female','Male','Other','Unknown'] as const;
const reason=z.string().trim().min(10,'Explain the reason in at least 10 characters.').max(500);
const csv=z.string().min(1,'Paste or choose a CSV file.').max(MAX_CSV,`The file is larger than ${MAX_CSV} characters. Split it into smaller batches.`);
export const importInput=z.object({csv}).strict();
export const patientImportSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('patientImportApply'),csv,planHash:z.string().regex(/^[0-9a-f]{64}$/),reason}).strict(),
]);
// RFC 4180 fields: commas, quoted fields with doubled quotes, CRLF or LF line ends. Blank lines are skipped.
export function parseCsv(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],field='',quoted=false,i=0;const s=text.replace(/^﻿/,'');
 const end=()=>{row.push(field);field='';};
 while(i<s.length){const ch=s[i];
  if(quoted){if(ch==='"'){if(s[i+1]==='"'){field+='"';i+=2;continue;}quoted=false;i++;continue;}field+=ch;i++;continue;}
  if(ch==='"'&&field===''){quoted=true;i++;continue;}
  if(ch===','){end();i++;continue;}
  if(ch==='\r'||ch==='\n'){end();if(row.some(x=>x.trim()!==''))rows.push(row);row=[];i+=ch==='\r'&&s[i+1]==='\n'?2:1;continue;}
  field+=ch;i++;}
 if(quoted)fail(422,'The CSV has an unclosed quoted field.');
 end();if(row.some(x=>x.trim()!==''))rows.push(row);return rows;
}
export type ImportRow={row:number;status:'accepted'|'rejected'|'duplicate';reasons:string[];teamId?:string;candidates?:{personId:string;version:number}[];duplicateOfRow?:number};
type Parsed={row:number;name:string;age:number;sex:string;village:string;programme:Programme;teamId:string};
// Teams the member may import into: a team they belong to and supervise (owner or supervisor with a care or
// supervisor role, or a supervision delegation in force for that team, through the slice 1e helper).
export function importsInto(s:OrgState,m:Member,teamId:string,now=new Date().toISOString(),record=false){return m.status==='active'&&['asha','clinician','supervisor'].includes(m.role)&&m.teamIds.includes(teamId)&&supervises(s,m,teamId,now,record);}
export function mayImport(s:OrgState,m:Member,now=new Date().toISOString()){return m.teamIds.some(t=>importsInto(s,m,t,now));}
export async function planImport(s:OrgState,m:Member,text:string,envName:string,now=new Date().toISOString()){
 if(!mayImport(s,m,now))fail(403,'Only an owner or supervisor with a care or supervisor role can import people, for teams they belong to.');
 const table=parseCsv(text);if(!table.length)fail(422,'The CSV is empty.');
 const header=table[0].map(h=>h.trim().toLowerCase()),missing=COLUMNS.filter(c=>!header.includes(c)),extra=header.filter(h=>!(COLUMNS as readonly string[]).includes(h));
 if(missing.length||extra.length||new Set(header).size!==header.length)fail(422,`The header must name exactly these columns once each: ${COLUMNS.join(', ')}.${missing.length?` Missing: ${missing.join(', ')}.`:''}${extra.length?` Not recognised: ${extra.length} column${extra.length===1?'':'s'}.`:''}`);
 const body=table.slice(1);if(!body.length)fail(422,'The CSV has a header but no rows.');if(body.length>MAX_ROWS)fail(422,`At most ${MAX_ROWS} rows per import; this file has ${body.length}.`);
 const col=(r:string[],c:typeof COLUMNS[number])=>(r[header.indexOf(c)]??'').trim();
 const rows:ImportRow[]=[],accepted:Parsed[]=[],teams=new Set<string>();
 for(const [n,r] of body.entries()){
  const row=n+1,reasons:string[]=[];
  if(r.length!==header.length)reasons.push(`Row ${row} has ${r.length} fields; the header has ${header.length}.`);
  const name=col(r,'name'),ageText=col(r,'age'),sexText=col(r,'sex'),village=col(r,'village'),programmeText=col(r,'programme'),teamText=col(r,'team');
  if(!name||name.length>200)reasons.push('Name is required, at most 200 characters.');
  const age=/^\d{1,3}$/.test(ageText)?Number(ageText):NaN;if(!(age>=0&&age<=120))reasons.push('Age must be a whole number from 0 to 120.');
  const sex=SEXES.find(x=>x.toLowerCase()===sexText.toLowerCase());if(!sex)reasons.push('Sex must be Female, Male, Other or Unknown.');
  if(!village||village.length>200)reasons.push('Village or locality is required, at most 200 characters.');
  const programme=PROGRAMMES.find(x=>x.toLowerCase()===programmeText.toLowerCase());if(!programme)reasons.push(`Programme must be one of: ${PROGRAMMES.join(', ')}.`);
  const team=s.teams.find(t=>t.id===teamText||t.name.toLowerCase()===teamText.toLowerCase());
  if(!team)reasons.push('Team is not a team of this organisation.');else if(!importsInto(s,m,team.id,now))reasons.push('Team is outside the teams you may import into.');
  if(reasons.length){rows.push({row,status:'rejected',reasons});continue;}
  const p:Parsed={row,name,age,sex:sex!,village,programme:programme!,teamId:team!.id};teams.add(p.teamId);
  const earlier=accepted.find(a=>a.teamId===p.teamId&&normalName(a.village)===normalName(p.village)&&Math.abs(a.age-p.age)<=2&&(normalName(a.name)===normalName(p.name)||nearName(normalName(a.name),normalName(p.name))));
  const match=await patientMatches(s,m,{name,age,sex:p.sex as any,village,teamId:p.teamId});
  if(match.candidates.length||match.overflow||earlier){rows.push({row,status:'duplicate',teamId:p.teamId,reasons:[...(match.candidates.length||match.overflow?[`Possible match with ${match.overflow?'more than 20':match.candidates.length} existing record${match.candidates.length===1&&!match.overflow?'':'s'} you can see. Register after review, not by import.`]:[]),...(earlier?[`Possible duplicate of row ${earlier.row} in this file.`]:[])],candidates:match.candidates.map(c=>({personId:c.id,version:c.version})),...(earlier?{duplicateOfRow:earlier.row}:{})});continue;}
  accepted.push(p);rows.push({row,status:'accepted',reasons:[],teamId:p.teamId});
 }
 // Bound to the rows as parsed and to every permitted record in the named teams, so any change forces a new dry run.
 const records=s.workspace.people.filter(p=>teams.has(p.teamId)&&allowed(m,p)).map(p=>[p.id,p.version]).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 const synthetic=POLICY[environmentOf({SAHA_ENVIRONMENT:envName}).name].fixtures;
 const planHash=await digest({import:IMPORT,environment:envName,synthetic,importer:m.userId,rows:rows.map(r=>[r.row,r.status,r.teamId??null,r.candidates??[],r.duplicateOfRow??null,r.reasons]),accepted,records});
 const counts={rows:rows.length,accepted:accepted.length,rejected:rows.filter(r=>r.status==='rejected').length,duplicates:rows.filter(r=>r.status==='duplicate').length};
 return {import:IMPORT,environment:envName,markedSynthetic:synthetic,counts,rows,planHash,accepted,notice:'Row numbers, ids, versions, counts and reasons only. Possible duplicates and rejected rows are never created by this import.'};
}
// The dry run as returned over HTTP: the parsed accepted rows (with names) stay on the server.
export const publicPlan=({accepted,...plan}:Awaited<ReturnType<typeof planImport>>)=>plan;
export function authorizePatientImport(s:OrgState,m:Member,c:any){if(c?.type==='patientImportApply'&&!mayImport(s,m))fail(403,'Only an owner or supervisor with a care or supervisor role can import people, for teams they belong to.');}
export async function applyPatientImport(s:OrgState,input:unknown,u:Actor,m:Member,env:Record<string,string|undefined>,now=new Date().toISOString()):Promise<any|null>{
 const parsed=patientImportSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizePatientImport(s,m,c);
 const e=environmentOf(env);if(e.name==='misconfigured')fail(409,'The environment is not configured correctly. Imports are refused until it is corrected.');
 const plan=await planImport(s,m,c.csv,e.name,now);
 if(plan.planHash!==c.planHash)fail(409,'The file or the records changed since the dry run. Run the dry run again and review it before applying.');
 if(!plan.accepted.length)fail(409,'The dry run has no rows to create.');
 const batchId=uuid(),created:{row:number;personId:string}[]=[];
 for(const r of plan.accepted){
  importsInto(s,m,r.teamId,now,true);
  const p:Person={id:uuid(),name:r.name,age:r.age,sex:r.sex,village:r.village,programmes:[r.programme,...(r.programme==='General care'?[]:['General care' as const])],task:'New home visit',due:'Today',status:'due',aiConsent:false,exchangeConsent:false,consentVersion:1,assigned:true,createdAt:now,version:1,teamId:r.teamId,assignedTo:null,
   identityReview:{state:'local',by:m.userId,at:now,reason:`Imported in batch ${batchId}; no candidate found in the permitted records at the dry run. No national identity verification claimed.`,candidateCount:0},imported:{batchId,row:r.row,at:now,by:u.userId,planHash:plan.planHash},...(plan.markedSynthetic?{synthetic:true}:{})};
  s.workspace.people.push(p);created.push({row:r.row,personId:p.id});
 }
 const k=plan.counts;
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:s.organisation.id,detail:`Import ${IMPORT} batch ${batchId} applied from dry run ${plan.planHash}: ${k.rows} rows, ${created.length} people created${plan.markedSynthetic?' and marked synthetic':''}, ${k.rejected} rejected, ${k.duplicates} possible duplicates left for review. Reason: ${c.reason}`});
 return {batchId,created,counts:{...k,created:created.length},markedSynthetic:plan.markedSynthetic};
}
