import { identity, loadFor, json, db, rawRuntime } from './server';
import { environmentOf } from './environment';
import { accountCode, scope } from './store';
import { recordExportAudit, sameCareScope } from './export-audit';
import { digest, fail, uuid } from './core';
import { operator } from './operations';
import { CHAIN_VERSION, CHECKPOINT_FORMAT, EXPORT_LIMIT, HASHING, checkCheckpoint, checkpointDigest, exportRows, parseCheckpointRef, sha256, verifyChain, lastRecordedCheckpoint } from './audit-chain';
// Slice 6j: chain verification and the auditor export, for owners and administrators only.
// Verification returns sequence numbers, hashes and reasons, never event content.
export async function auditChainRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 if(!operator(m))fail(403,'Owner or administrator access is required to verify the audit chain.');
 const url=new URL(request.url),format=url.searchParams.get('format')??'verify';
 if(!['verify','jsonl','checkpoint'].includes(format))fail(422,'Unsupported audit chain format.');
 const ref=url.searchParams.get('checkpoint'),expected=ref===null?null:parseCheckpointRef(ref);if(ref!==null&&!expected)fail(422,'Give a checkpoint as sequence:hash (64 lowercase hexadecimal characters).');
 const verification=await verifyChain(db(),s.organisation.id);
 // Slice 6t: verification can also check a checkpoint kept outside Saha.
 if(format==='verify')return json(expected?{...verification,checkpoint:await checkCheckpoint(db(),s.organisation.id,expected.seq,expected.hash)}:verification);
 if(format==='checkpoint')return checkpointResponse(s,u,m,verification,expected);
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
// Slice 6t: an intact chain's head, for the owner or administrator to keep outside Saha. Issuing it is recorded in
// the chain (through the export audit helper, so it fails closed and is retried on a fresh read like an export).
// Slice 6w (fifth review, finding 8): past VERIFY_LIMIT events a full verification is `incomplete`. The checkpoint is
// then verified from an anchor: the checkpoint the owner names (`checkpoint=seq:hash`, kept outside Saha) or else
// the last checkpoint issued and recorded in the chain. The response and the audit line say which anchor was used.
async function checkpointResponse(s:Awaited<ReturnType<typeof loadFor>>,u:Awaited<ReturnType<typeof identity>>,m:ReturnType<typeof scope>,full:Awaited<ReturnType<typeof verifyChain>>,named:{seq:number;hash:string}|null){
 let verification=full;
 if(full.status==='incomplete'){const anchor=named??await lastRecordedCheckpoint(db(),s.organisation.id);if(anchor)verification=await verifyChain(db(),s.organisation.id,undefined,undefined,anchor);}
 if(verification.status!=='intact'||!verification.head)fail(409,`The audit chain is ${verification.status}, so no checkpoint is issued. Verify the chain to see why.`);
 const orgId=s.organisation.id,issuedAt=new Date().toISOString(),head=verification.head!,eventId=uuid();
 const point={organisationId:orgId,seq:head.seq,hash:head.hash,at:head.at,issuedAt},checkpointSha256=await checkpointDigest(point);
 const from=verification.fromAnchor?` from the anchor at event ${verification.fromAnchor.seq}`:'';
 const detail=`Chain head checkpoint issued for external anchoring: event ${head.seq}, hash ${head.hash}, ${verification.events} chained events verified intact${from}; checkpoint SHA-256 ${checkpointSha256}.`;
 const again=(x:typeof s)=>{const o=scope(x,u.userId);if(!operator(o))fail(403,'Owner or administrator access is required to verify the audit chain.');if(o.role!==m.role)fail(409,'Your role changed while the checkpoint was prepared. Try again.');return o;};
 await recordExportAudit(db(),{state:s,reload:()=>loadFor(u,orgId),authorize:again,event:o=>({id:eventId,at:issuedAt,actorId:u.userId,actor:u.displayName,role:o.role,action:'auditChainCheckpoint',subject:orgId,detail}),actor:u,type:'auditChainCheckpoint',key:'checkpoint_'+uuid(),hash:await digest(point)});
 const body={format:CHECKPOINT_FORMAT,chainVersion:CHAIN_VERSION,organisationId:orgId,head:{seq:head.seq,hash:head.hash,at:head.at},eventsVerified:verification.events,verifiedFrom:verification.fromAnchor??null,issuedAt,issuedBy:{accountCode:await accountCode(u.userId),role:m.role,owner:m.isOwner},checkpointSha256,digestRule:`checkpointSha256 = SHA-256 of JSON.stringify(['${CHECKPOINT_FORMAT}',organisationId,head.seq,head.hash,head.at,issuedAt])`,recordedAs:eventId,anchoring:'Keep this file, or its checkpointSha256, somewhere the people who run this Saha database cannot change (for example a ticket, a signed email or a public log). Later, check it against the chain: the same hash at the same sequence number proves nothing up to it has changed. Saha does not sign this file.'};
 return new Response(JSON.stringify(body,null,2)+'\n',{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="saha-audit-checkpoint-${head.seq}.json"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
