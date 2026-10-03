import { z } from 'zod';
import { digest, fail, uuid } from './core';
import { environmentOf } from './environment';
import { defaultOperations } from './operations';
import { csvBytes, MAX_CSV, MAX_ROWS, parseCsv } from './patient-import';
import { rosterDiff, type RosterRow } from './roster';
import type { Member, OrgState, Role } from './types';
import type { Actor } from './store';
// Slice 10d: workforce roster import from a CSV file (BR-ID-01), on the slice 1d roster rules and the slice 2f and 2h
// dry-run, plan-hash and apply pattern. An organisation owner uploads the roster an institution keeps as a spreadsheet:
// name, account code, role, team, status and an optional external staff id. The dry run classifies every row as an
// invitation to create, a membership to update (role, teams, suspension or a recorded staff id), no change, a conflict
// left for review or a rejected row with reasons; it returns row numbers, actions, reasons and a plan hash, never names,
// account codes or staff ids, and stores nothing. Apply recomputes the dry run and accepts only that exact plan.
// Slice 1d rules are reused by calling `rosterDiff` for every row that passes the file checks: an import never removes
// a membership, never reactivates a local suspension, never changes an owner flag, never suspends an owner, never
// changes the importer's own membership and leaves the slice 9a demonstration fixture clinicians alone. Unlike the
// pasted roster, an import never suspends a person merely because the file does not list them.
export const WORKFORCE_IMPORT='workforce-import-v1';
export const COLUMNS=['name','account_code','role','team','status'] as const;
export const OPTIONAL_COLUMNS=['external_staff_id'] as const;
export const WORKFORCE_ROLES=['asha','clinician','supervisor','admin'] as const;
const ACCOUNT=/^[A-Fa-f0-9]{24}$/,STAFF_ID=/^[A-Za-z0-9][A-Za-z0-9/._-]{0,63}$/,CONTROL=/[\u0000-\u001f\u007f]/;
export const WORKFORCE_REFUSED='Only an organisation owner can import a workforce roster.';
const reason=z.string().trim().min(10,'Explain the reason in at least 10 characters.').max(500);
const tooLarge=`The file is larger than ${MAX_CSV.toLocaleString('en-IN')} bytes. Split it into smaller batches.`;
const csv=z.string().min(1,'Paste or choose a CSV file.').max(MAX_CSV,tooLarge).refine(x=>csvBytes(x)<=MAX_CSV,tooLarge);
export const workforceImportInput=z.object({csv}).strict();
export const workforceImportSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('workforceImportApply'),csv,planHash:z.string().regex(/^[0-9a-f]{64}$/),reason}).strict(),
]);
export type WorkforceAction='invite'|'update'|'suspend'|'none'|'conflict'|'rejected';
export type WorkforceRow={row:number;action:WorkforceAction;reasons:string[];detail:string;role?:Role;teams?:string[];staffId?:'record'};
// The staff id register lives in one JSON record, so it is bounded; the batch id leads to the audit event (time, importer).
export const MAX_STAFF_IDS=3000;
export type StaffRecord={id:string;batchId:string};
type Step={row:number;action:'invite'|'update'|'suspend';accountCode:string;name:string;role?:Role;teamIds?:string[];userId?:string;membership:boolean;staffId?:string};
const header=(table:string[][])=>{
 const h=table[0].map(x=>x.trim().toLowerCase()),known=[...COLUMNS,...OPTIONAL_COLUMNS] as readonly string[],missing=COLUMNS.filter(c=>!h.includes(c)),extra=h.filter(x=>!known.includes(x));
 if(missing.length||extra.length||new Set(h).size!==h.length)fail(422,`The header must name these columns once each: ${COLUMNS.join(', ')}; and may add ${OPTIONAL_COLUMNS.join(', ')}.${missing.length?` Missing: ${missing.join(', ')}.`:''}${extra.length?` Not recognised: ${extra.length} column${extra.length===1?'':'s'}.`:''}`);
 return h;
};
const sameList=(a:string[],b:string[])=>[...a].sort().join('|')===[...b].sort().join('|');
type Parsed={row:number;reasons:string[];code?:string;name:string;role?:RosterRow['role'];teamNames:string[];status?:'active'|'left';staffId:string};
// The dry run. Names, account codes and staff ids stay on the server side of the plan (`steps`); see publicWorkforcePlan.
export async function planWorkforceImport(s:OrgState,m:Member,text:string,envName:string,now=new Date().toISOString()){
 if(!m.isOwner||m.status!=='active')fail(403,WORKFORCE_REFUSED);
 const table=parseCsv(text);if(!table.length)fail(422,'The CSV is empty.');const h=header(table);
 const body=table.slice(1);if(!body.length)fail(422,'The CSV has a header but no rows.');if(body.length>MAX_ROWS)fail(422,`At most ${MAX_ROWS} rows per import; this file has ${body.length}.`);
 const col=(r:string[],c:string)=>h.includes(c)?(r[h.indexOf(c)]??'').trim():'';
 const teamId=(t:string)=>s.teams.find(x=>x.id===t||x.name.toLowerCase()===t.toLowerCase())?.id;
 const staff=s.operations?.staffIds??{},byId=new Map(Object.entries(staff).map(([k,v])=>[v.id.toLowerCase(),k] as [string,string]));let recorded=0;
 const parsed:Parsed[]=body.map((r,n)=>{
  const row=n+1,reasons:string[]=[],p:Parsed={row,reasons,name:'',teamNames:[],staffId:''};
  if(r.length!==h.length){reasons.push(`Row ${row} has ${r.length} fields; the header has ${h.length}.`);return p;}
  p.name=col(r,'name');if(!p.name)reasons.push('Name is required.');else if(p.name.length>200)reasons.push('Name is longer than 200 characters.');else if(CONTROL.test(p.name))reasons.push('Name must not contain control characters.');
  const code=col(r,'account_code');if(ACCOUNT.test(code))p.code=code.toUpperCase();else reasons.push('Account code must be the 24-character code shown in the person\'s account.');
  const status=col(r,'status').toLowerCase();if(status==='active'||status==='left')p.status=status;else reasons.push('Status must be active or left.');
  const role=col(r,'role').toLowerCase();
  // A leaver's role and teams are not needed to suspend them and may be out of date in the source system; such a row
  // is never held back by them, because failing to suspend a leaver is the unsafe way to fail.
  if((WORKFORCE_ROLES as readonly string[]).includes(role))p.role=role as RosterRow['role'];else if(status!=='left')reasons.push(`Role must be one of ${WORKFORCE_ROLES.join(', ')}.`);
  const teams=col(r,'team').split(';').map(x=>x.trim()).filter(Boolean);
  if(teams.length>20)reasons.push('At most 20 teams per row.');else if(teams.some(x=>x.length>200))reasons.push('Team names are at most 200 characters.');
  else if(status!=='left'){p.teamNames=teams;const unknown=teams.filter(x=>!teamId(x)).length;if(unknown)reasons.push(`${unknown} team name${unknown===1?'':'s'} on this row ${unknown===1?'does':'do'} not match a team in this organisation.`);else if(p.role&&p.role!=='admin'&&!teams.length)reasons.push('A care or supervisor role needs a team.');}
  const staffId=col(r,'external_staff_id');if(staffId){if(STAFF_ID.test(staffId))p.staffId=staffId;else reasons.push('External staff id must be 1 to 64 letters, digits or the characters / . _ - and start with a letter or digit.');}
  return p;
 });
 // Repeats inside the file are ambiguous, so none of the rows involved is applied.
 const group=(key:(p:Parsed)=>string|undefined,text:(rows:string)=>string)=>{const by=new Map<string,Parsed[]>();for(const p of parsed){const k=key(p);if(k)by.set(k,[...(by.get(k)??[]),p]);}for(const rows of by.values())if(rows.length>1)for(const p of rows)p.reasons.push(text(rows.map(x=>x.row).join(', ')));};
 group(p=>p.code,rows=>`This account code appears on rows ${rows}; none of them is applied. Keep one row per person.`);
 const codesOf=new Map<string,Set<string>>();for(const p of parsed)if(p.staffId&&p.code){const k=p.staffId.toLowerCase();codesOf.set(k,new Set([...(codesOf.get(k)??[]),p.code]));}
 group(p=>p.staffId&&p.code&&(codesOf.get(p.staffId.toLowerCase())?.size??0)>1?p.staffId.toLowerCase():undefined,rows=>`This staff id appears on rows ${rows} for different account codes; none of them is applied.`);
 const rows:WorkforceRow[]=parsed.map(p=>({row:p.row,action:'rejected',reasons:p.reasons,detail:p.reasons.length?'Rejected: not applied.':''}));
 const steps:Step[]=[],valid=parsed.filter(p=>!p.reasons.length);
 const asRoster:RosterRow[]=valid.map(p=>({accountCode:p.code!,name:p.name,role:p.role??'asha',teams:p.status==='left'?[]:p.teamNames,status:p.status!}));
 // Slice 1d classification, unchanged. Every row that passed the file checks yields exactly one action and no error.
 const diff=asRoster.length?await rosterDiff(s,asRoster,false,m.userId,now):{actions:[],errors:[] as string[],counts:{}};
 if(diff.errors.length||diff.actions.length!==asRoster.length)fail(422,`The roster could not be checked: ${diff.errors[0]??'row count mismatch'}`);
 valid.forEach((p,i)=>{
  const a=diff.actions[i],out=rows[p.row-1],code=p.code!,member=s.members.find(x=>x.accountCode===code),pending=s.invitations.find(x=>x.accountCode===code&&x.status==='pending'&&x.expiresAt>now);
  const teamIds=[...new Set(p.teamNames.map(teamId).filter(Boolean) as string[])].sort();
  let action:WorkforceAction=a.action,detail=a.detail,eligible=false;const why:string[]=[];
  if(member?.role==='provider'){action='conflict';why.push('Provider accounts are managed in the provider sandbox and are not changed by import.');}
  else if(action==='none'&&p.status==='left'&&pending&&(a.detail==='Not a member.'||a.detail.startsWith('Already '))){action='conflict';why.push('A current invitation exists for a person listed as left. Revoke the invitation by hand.');}
  else if(action==='none'&&a.detail==='A current invitation already exists.'&&pending&&(pending.role!==p.role||!sameList(pending.teamIds,teamIds))){action='conflict';why.push('A current invitation exists with a different role or team. Revoke it and import again.');}
  else eligible=action==='invite'||action==='update'||action==='suspend'||(action==='none'&&(a.detail==='No change.'||a.detail==='A current invitation already exists.'));
  let record=false;
  if(eligible&&p.staffId){
   const held=staff[code],lower=p.staffId.toLowerCase();
   if(held&&held.id.toLowerCase()!==lower){action='conflict';why.push('This account already has a different external staff id recorded; an import does not replace it.');}
   else if(!held&&byId.has(lower)&&byId.get(lower)!==code){action='conflict';why.push('This external staff id is already recorded for another account in this organisation.');}
   else if(!held&&Object.keys(staff).length+recorded>=MAX_STAFF_IDS){action='conflict';why.push(`This organisation already holds the most external staff ids that this version records (${MAX_STAFF_IDS.toLocaleString('en-IN')}).`);}
   else if(!held){record=true;recorded++;if(action==='none'){action='update';detail=a.detail==='No change.'?'Membership unchanged; records the external staff id.':'The current invitation is unchanged; records the external staff id.';}else detail+=' Records the external staff id.';}
  }
  out.action=action;
  if(action==='conflict'){out.reasons=why.length?why:[a.detail];out.detail=`Not applied: ${out.reasons[0]}`;return;}
  out.reasons=[];out.detail=detail;
  if(a.role)out.role=a.role;
  if(a.teamIds)out.teams=a.teamIds.map(t=>s.teams.find(x=>x.id===t)?.name??t);
  if(record)out.staffId='record';
  if(action==='invite'||action==='update'||action==='suspend')steps.push({row:p.row,action,accountCode:code,name:p.name,role:a.role,teamIds:a.teamIds,userId:a.userId,membership:a.action!=='none',...(record?{staffId:p.staffId}:{})});
 });
 const count=(k:WorkforceAction)=>rows.filter(r=>r.action===k).length;
 const counts={rows:rows.length,invite:count('invite'),update:count('update'),suspend:count('suspend'),unchanged:count('none'),conflict:count('conflict'),rejected:count('rejected'),staffIds:steps.filter(x=>x.staffId).length};
 // Bound to every cell of the file as parsed, to its classification, the importer, the environment, every membership's version and status,
 // the teams, the pending invitations and the recorded staff ids, so a change to any of them forces a new dry run.
 const planHash=await digest({import:WORKFORCE_IMPORT,environment:envName,importer:m.userId,file:parsed.map(p=>[p.row,p.name,p.code??null,p.role??null,p.teamNames,p.status??null,p.staffId]),rows:rows.map(r=>[r.row,r.action,r.reasons,r.detail,r.role??null,r.teams??null,r.staffId??null]),steps,
  members:s.members.map(x=>[x.userId,x.version,x.status]).sort((x,y)=>String(x[0]).localeCompare(String(y[0]))),teams:s.teams.map(t=>[t.id,t.name]).sort((x,y)=>x[0].localeCompare(y[0])),
  invitations:s.invitations.filter(i=>i.status==='pending').map(i=>[i.id,i.accountCode,i.expiresAt]).sort((x,y)=>x[0].localeCompare(y[0])),staffIds:Object.entries(staff).map(([k,v])=>[k,v.id]).sort((x,y)=>x[0].localeCompare(y[0]))});
 return {import:WORKFORCE_IMPORT,environment:envName,counts,rows,planHash,steps,notice:'Row numbers, actions, roles, team names and reasons only. Rejected rows and conflicts are never applied; people not listed are never suspended.'};
}
// The dry run as returned over HTTP: names, account codes and staff ids stay on the server.
export const publicWorkforcePlan=({steps,...plan}:Awaited<ReturnType<typeof planWorkforceImport>>)=>plan;
// The plan as the rejection report reads it (slice 2h): rows that are neither rejected nor in conflict count as accepted.
export const workforceReportPlan=(plan:Awaited<ReturnType<typeof planWorkforceImport>>)=>({import:plan.import,planHash:plan.planHash,counts:{rows:plan.counts.rows,accepted:plan.counts.rows-plan.counts.rejected-plan.counts.conflict},
 rows:plan.rows.map(r=>({row:r.row,status:r.action==='rejected'?'rejected':r.action==='conflict'?'conflict':'accepted',reasons:r.reasons}))});
export function authorizeWorkforceImport(s:OrgState,m:Member,c:any){if(c?.type==='workforceImportApply'&&!(m.isOwner&&m.status==='active'))fail(403,WORKFORCE_REFUSED);}
export async function applyWorkforceImport(s:OrgState,input:unknown,u:Actor,m:Member,env:Record<string,string|undefined>,now=new Date().toISOString()):Promise<any|null>{
 const parsed=workforceImportSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeWorkforceImport(s,m,c);
 const e=environmentOf(env);if(e.name==='misconfigured')fail(409,'The environment is not configured correctly. Imports are refused until it is corrected.');
 const plan=await planWorkforceImport(s,m,c.csv,e.name,now);
 if(plan.planHash!==c.planHash)fail(409,'The file, the roster or the memberships changed since the dry run. Run the dry run again and review it before applying.');
 if(!plan.steps.length)fail(409,'The dry run has nothing to apply.');
 const batchId=uuid(),invitations:{row:number;accountCode:string;token:string;expiresAt:string}[]=[],w=s.workspace;
 const keep=(code:string,r:StaffRecord)=>{const ops=s.operations??=defaultOperations();(ops.staffIds??={})[code]=r;};
 const audit=(subject:string,detail:string)=>w.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject,detail});
 for(const x of plan.steps){
  const row=plan.rows[x.row-1],subject=x.userId??x.accountCode;
  if(x.action==='invite'){
   const bytes=crypto.getRandomValues(new Uint8Array(32)),token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''),expiresAt=new Date(Date.parse(now)+72*3600000).toISOString();
   s.invitations.push({id:uuid(),accountCode:x.accountCode,label:x.name,role:x.role!,teamIds:x.teamIds!,status:'pending',expiresAt,createdBy:u.userId,createdAt:now,tokenHash:await digest(token)});invitations.push({row:x.row,accountCode:x.accountCode,token,expiresAt});
  }else if(x.membership){
   const t=s.members.find(y=>y.userId===x.userId)!;
   if(x.action==='update')Object.assign(t,{role:x.role,teamIds:x.teamIds,version:t.version+1});else Object.assign(t,{status:'suspended',version:t.version+1});
  }
  if(x.staffId)keep(x.accountCode,{id:x.staffId,batchId});
  audit(subject,`Row ${x.row} of workforce import batch ${batchId}: ${row.detail} Reason: ${c.reason}`);
 }
 const k=plan.counts;
 audit(s.organisation.id,`Workforce import ${WORKFORCE_IMPORT} batch ${batchId} applied from dry run ${plan.planHash}: ${k.rows} rows, ${k.invite} invited, ${k.update} updated, ${k.suspend} suspended, ${k.unchanged} unchanged, ${k.conflict} conflicts and ${k.rejected} rejected rows not applied, ${k.staffIds} external staff ids recorded. Reason: ${c.reason}`);
 return {batchId,counts:k,invitations,rows:plan.steps.map(x=>x.row)};
}
