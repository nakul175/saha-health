import { identity, loadFor, json, db, rawRuntime } from './server';
import { environmentOf } from './environment';
import { accountCode, scope } from './store';
import { recordExportAudit, sameCareScope } from './export-audit';
import { digest, fail, uuid } from './core';
import { operator } from './operations';
import { CHAIN_VERSION, EXPORT_LIMIT, HASHING, exportRows, sha256, verifyChain } from './audit-chain';
// Slice 6j: chain verification and the auditor export, for owners and administrators only.
// Verification returns sequence numbers, hashes and reasons, never event content.
export async function auditChainRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 if(!operator(m))fail(403,'Owner or administrator access is required to verify the audit chain.');
 const url=new URL(request.url),format=url.searchParams.get('format')??'verify';
 if(!['verify','jsonl'].includes(format))fail(422,'Unsupported audit chain format.');
 const verification=await verifyChain(db(),s.organisation.id);
 if(format==='verify')return json(verification);
 const fromText=url.searchParams.get('from')??'0';if(!/^\d{1,9}$/.test(fromText))fail(422,'Choose a starting sequence number.');const from=Number(fromText);
 const page=await exportRows(db(),s.organisation.id,{userId:u.userId,role:m.role},from);
 if(!page.lines.length)fail(404,'No chained audit events from that sequence number.');
 const exportedAt=new Date().toISOString(),eventId=uuid();
 const header={type:'header',format:'saha-audit-chain-export-v1',chainVersion:CHAIN_VERSION,organisationId:s.organisation.id,generatedAt:exportedAt,range:{from,to:page.to},more:page.more,nextFrom:page.more?page.to!+1:null,maxEvents:EXPORT_LIMIT,hashing:HASHING,environment:environmentOf(rawRuntime()).name,notice:'Contains account identifiers and audit details. Keep within authorised auditors. Events written before the chain started are sealed by the genesis marker (sequence 0) and are not listed.'};
 const body=[header,...page.lines].map(x=>JSON.stringify(x)).join('\n')+'\n',bodySha256=await sha256(body);
 // Slice 6p: the audit commit is retried on a fresh read if a command saved meanwhile; the exporter
 // must still be an owner or administrator with the same role (the redaction depended on it). Slice 6q (second
 // review): and with the same care scope (sorted team ids), as the data-exit route already requires.
 const orgId=s.organisation.id,detail=`Audit chain exported: events ${from}–${page.to}${page.more?' (more remain)':''}, ${page.redacted} patient-linked events as digests only; verification ${verification.status}${verification.head?` at head ${verification.head.seq}`:''}; file SHA-256 ${bodySha256}.`;
 const again=(x:typeof s)=>{const o=scope(x,u.userId);if(!operator(o))fail(403,'Owner or administrator access is required to verify the audit chain.');if(o.role!==m.role)fail(409,'Your role changed while the export was prepared. Export again.');sameCareScope(m,o);return o;};
 await recordExportAudit(db(),{state:s,reload:()=>loadFor(u,orgId),authorize:again,event:o=>({id:eventId,at:exportedAt,actorId:u.userId,actor:u.displayName,role:o.role,action:'auditChainExport',subject:orgId,detail}),actor:u,type:'auditChainExport',key:'export_'+uuid(),hash:await digest({from,bodySha256})});
 const signoff={type:'signoff',exportedBy:{name:u.displayName,accountCode:await accountCode(u.userId),role:m.role,owner:m.isOwner},exportedAt,range:{from,to:page.to},events:page.lines.length,redacted:page.redacted,head:verification.head,verification:{status:verification.status,firstBreak:verification.firstBreak,events:verification.events,priorEvents:verification.priorEvents},bodySha256,recordedAs:eventId,signature:`No signing key is provisioned. This export is recorded in the audit chain as event ${eventId}, whose detail carries bodySha256 (the SHA-256 of every line above this one).`};
 return new Response(body+JSON.stringify(signoff)+'\n',{headers:{'Content-Type':'application/x-ndjson; charset=utf-8','Content-Disposition':`attachment; filename="saha-audit-chain-${from}-${page.to}.jsonl"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
