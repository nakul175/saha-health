import { contactSchema, type ContactPreferences } from './outreach';
import { digest, fail, uuid } from './core';
import { normallyAllowed } from './access';
import { importsInto, mayImport } from './patient-import';
import { ensurePurpose } from './purpose-scope';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';
export const CONTACT_COLUMNS=['person','method','destination','ownership','language','timezone','from','to','private_contact','reference','source_system'] as const;
export type ImportedContact={id:string;batchId:string;row:number;fileDigest:string;planHash:string;sourceSystem:string;at:string;by:string;preferences:ContactPreferences;withdrawal?:{at:string;by:string;reason:string;planHash:string}};
export function authorizeContactImport(s:OrgState,m:Member){if(!mayImport(s,m))fail(403,'Current supervised care-team import authority is required.');ensurePurpose(m,'care-coordination');}
export async function planContactRows(s:OrgState,m:Member,header:string[],body:string[][],file:string,env:string,now:string,resolve:(ref:string)=>{person?:Person;reason?:string}){
 authorizeContactImport(s,m);const accepted:{kind:'contacts';row:number;personId:string;preferences:Omit<ContactPreferences,'version'|'updatedAt'|'by'>;sourceSystem:string}[]=[],rows:{row:number;status:'accepted'|'rejected';reasons:string[];personId?:string;version?:number}[]=[];
 for(const [n,r]of body.entries()){
  const col=(k:string)=>(r[header.indexOf(k)]??'').trim(),row=n+1,reasons:string[]=[],who=resolve(col('person')),p=who.person;
  if(r.length!==header.length)reasons.push('The row has a different number of fields from the header.');if(who.reason)reasons.push(who.reason);
  const parsed=contactSchema.safeParse({method:col('method'),destination:col('destination'),ownership:col('ownership'),language:col('language'),timezone:col('timezone'),from:col('from'),to:col('to'),privateContact:col('private_contact')==='true',permission:false,reference:col('reference')});
  if(!parsed.success)reasons.push('Contact fields must use the supported synthetic format, contact method, ownership, language, time zone, hours and source reference.');
  if(!['true','false'].includes(col('private_contact')))reasons.push('private_contact must be true or false.');
  if(parsed.success){if(parsed.data.from>=parsed.data.to)reasons.push('Contact hours must end after they start.');if(parsed.data.method==='sms'&&!parsed.data.destination)reasons.push('SMS contact needs a synthetic TEST- destination.');if(parsed.data.method!=='sms'&&parsed.data.destination)reasons.push('A non-SMS contact must have an empty destination.');}
  if(col('source_system').length<3||col('source_system').length>100)reasons.push('Source system must contain 3 to 100 characters.');
  if(p){if(!normallyAllowed(m,p)||!importsInto(s,m,p.teamId,now))reasons.push('No record in the teams you may import into matches this person.');if(p.contactPreferences)reasons.push('Existing contact preferences are retained. Review them individually; an import never replaces them.');if((p.importedContacts??[]).length>=100)reasons.push('Retained contact import history is at capacity.');if(accepted.some(x=>x.personId===p.id))reasons.push('An earlier accepted row already supplies a contact for this record.');}
  if(!reasons.length&&p&&parsed.success){accepted.push({kind:'contacts',row,personId:p.id,preferences:parsed.data,sourceSystem:col('source_system')});rows.push({row,status:'accepted',personId:p.id,version:p.version,reasons:[]});}else rows.push({row,status:'rejected',reasons,...(p&&normallyAllowed(m,p)?{personId:p.id,version:p.version}:{})});
 }
 const fileDigest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(file)))].map(b=>b.toString(16).padStart(2,'0')).join(''),planHash=await digest({import:'saha-contact-import-v1',importer:m.userId,environment:env,fileDigest,rows,accepted});
 return {accepted,rows,fileDigest,planHash,counts:{rows:rows.length,accepted:accepted.length,rejected:rows.length-accepted.length},notice:'Imported contacts never grant permission or send messages. Existing contact preferences are never replaced. A current care worker must separately record permission.'};
}
export async function applyContactRows(s:OrgState,plan:Awaited<ReturnType<typeof planContactRows>>,reason:string,u:Actor,m:Member,now:string){
 authorizeContactImport(s,m);const batchId=uuid();
 for(const a of plan.accepted){const p=s.workspace.people.find(x=>x.id===a.personId)!;importsInto(s,m,p.teamId,now,true);const preferences:ContactPreferences={...a.preferences,permission:false,version:1,updatedAt:now,by:u.userId};p.contactPreferences=preferences;p.contactPreferenceRecords=[preferences];(p.importedContacts??=[]).push({id:uuid(),batchId,row:a.row,fileDigest:plan.fileDigest,planHash:plan.planHash,sourceSystem:a.sourceSystem,at:now,by:u.userId,preferences:structuredClone(preferences)});p.version++;}
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'recordImportApply',subject:s.organisation.id,detail:`Contact import batch ${batchId}; file SHA-256 ${plan.fileDigest}; reviewed plan ${plan.planHash}; ${plan.accepted.length} contacts recorded without contact permission; ${plan.counts.rejected} rejected. Reason: ${reason}`});
 return {batchId,kind:'contacts',counts:{...plan.counts,applied:plan.accepted.length,records:plan.accepted.length},rows:plan.accepted.map(x=>x.row)};
}
export function contactBatch(s:OrgState,m:Member,batchId:string){authorizeContactImport(s,m);const records=s.workspace.people.flatMap(p=>(p.importedContacts??[]).filter(e=>e.batchId===batchId).map(e=>({p,e})));if(!records.length)fail(404,'Contact import batch not found.');for(const {p}of records)if(!normallyAllowed(m,p)||p.mergedInto||!importsInto(s,m,p.teamId))fail(403,'Current supervised care access to every batch record is required.');return records;}
export async function planContactReversal(s:OrgState,m:Member,batchId:string,env:string){
 const records=contactBatch(s,m,batchId),rows=[];
 for(const {p,e}of records){if(e.withdrawal)fail(409,'This batch already has a recorded reversal.');if(await digest(p.contactPreferences??null)!==await digest(e.preferences)||p.contactPreferences?.permission)fail(409,'A contact changed or acquired permission. Review it individually; batch reversal cannot overwrite current care choices.');rows.push({personId:p.id,version:p.version,row:e.row,entryId:e.id});}
 return {kind:'contacts-reversal',batchId,rows,counts:{rows:rows.length,accepted:rows.length,rejected:0},planHash:await digest({import:'saha-contact-reversal-v1',batchId,importer:m.userId,environment:env,rows,entries:records.map(({e})=>e)}),notice:'Reversal clears only unchanged imported preferences. Source records remain in an append-only history with a withdrawal entry. Edited or permission-bearing contacts require individual review.'};
}
export async function applyContactReversal(s:OrgState,m:Member,u:Actor,c:{batchId:string;planHash:string;reason:string},env:string,now:string){
 const plan=await planContactReversal(s,m,c.batchId,env);if(plan.planHash!==c.planHash)fail(409,'Batch records changed. Review a new reversal dry run.');
 for(const {p,e}of contactBatch(s,m,c.batchId)){delete p.contactPreferences;delete p.contactPreferenceRecords;e.withdrawal={at:now,by:u.userId,reason:c.reason,planHash:plan.planHash};p.version++;}
 s.workspace.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:'recordImportContactsReverse',subject:s.organisation.id,detail:`Contact import batch ${c.batchId} reversed under reviewed plan ${plan.planHash}; ${plan.rows.length} unchanged imported contacts cleared; original source lineage retained. Reason: ${c.reason}`});
 return {batchId:c.batchId,kind:'contacts-reversal',counts:{...plan.counts,applied:plan.rows.length,records:plan.rows.length},rows:plan.rows.map(x=>x.row)};
}
