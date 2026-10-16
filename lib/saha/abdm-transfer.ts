import { z } from 'zod';
import { fail, person, uuid } from './core';
import { assertPatientDocumentNotes, assertOutboundPrivacy, fhirDocument } from './fhir-document';
import { validateOutbound, type ValidationStamp } from './fhir-validate';
import { abdmOperation, consentAllows, effective, requireAbdmCapability } from './abdm';
import type { Actor } from './store';
import type { Member, OrgState, Person } from './types';

// Slice 7b: care-context linking (HIP side) and a consent-bound, encrypted health-information
// transfer with received-record review (HIU side), both against the local mock gateway
// (BR-INT-18, BR-INT-19). The mock HIP is this organisation's own confirmed visits. The transfer
// uses X25519 key agreement, HKDF-SHA-256 and AES-256-GCM with per-side nonces; it is not
// validated against ABDM's encryption library or any partner.
export type CareContext={id:string;visitId:string;display:string;hiType:'OPConsultation';recordDate:string;linkedAt:string;linkedBy:string;abhaNumber:string};
export type ReceivedRecord={id:string;consentId:string;transferId:string;careContextId:string;hiType:string;recordDate:string;checksum:string;bundle:any;validation?:ValidationStamp;state:'review'|'accepted'|'rejected';receivedAt:string;reviewedBy?:string;reviewedAt?:string;note?:string};
export type Transfer={id:string;consentId:string;requestedAt:string;requestedBy:string;state:'delivered'|'failed';entries:number;acknowledgedAt?:string;message:string};
const id=z.string().trim().min(1).max(200),version=z.number().int().positive();
export const transferSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('abdmCareContextLink'),personId:id,version,visitIds:z.array(id).min(1).max(20).refine(x=>new Set(x).size===x.length,'List each visit once.')}).strict(),
 z.object({type:z.literal('abdmFetch'),personId:id,version,consentId:id}).strict(),
 z.object({type:z.literal('abdmReceivedReview'),personId:id,version,recordId:id,decision:z.enum(['accepted','rejected']),note:z.string().trim().min(5).max(1000)}).strict(),
]);
const TYPES=new Set(['abdmCareContextLink','abdmFetch','abdmReceivedReview']);
export function authorizeTransfer(_s:OrgState,m:Member,c:any){if(TYPES.has(c?.type)&&m.role!=='clinician')fail(403,'A clinician with access to the patient is required.');}
const b64=(b:ArrayBuffer|Uint8Array)=>{const u=b instanceof Uint8Array?b:new Uint8Array(b);let s='';for(const x of u)s+=String.fromCharCode(x);return btoa(s);};
const unb64=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
const buf=(u:Uint8Array)=>u as unknown as BufferSource;
const sha=async(text:string)=>b64(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)));
async function sessionKey(priv:CryptoKey,peerRaw:Uint8Array,nonceA:Uint8Array,nonceB:Uint8Array){
 const peer=await crypto.subtle.importKey('raw',buf(peerRaw),{name:'X25519'},false,[]);
 const shared=await crypto.subtle.deriveBits({name:'X25519',public:peer},priv,256);
 const mix=nonceA.map((x,i)=>x^nonceB[i]);
 const base=await crypto.subtle.importKey('raw',shared,'HKDF',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:buf(mix.slice(0,20)),info:new TextEncoder().encode('saha-mock-hi-transfer')},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
 return {key,iv:buf(mix.slice(20,32))};
}
const pair=()=>crypto.subtle.generateKey({name:'X25519'},true,['deriveBits']) as Promise<CryptoKeyPair>;
// Mock HIP: encrypt each permitted care context for the requester's public key.
function exchangeScope(s:OrgState){const cfg=abdmConfig(s);if(!cfg)fail(409,'The ABDM configuration is unavailable.');return {requesterFacilityId:cfg.facilityId,providerFacilityId:cfg.facilityId,configVersion:cfg.version};}
function assertExchangeConsent(p:Person,s:OrgState,consentId:string,now:string){
 const consent=(p.abdmConsents??[]).find(x=>x.id===consentId);if(!consent)fail(404,'Consent artefact not found.');
 const allowed=consentAllows(p,consentId,{hiType:consent.hiTypes[0],date:consent.from,purpose:consent.purpose,...exchangeScope(s)},now);
 if(!allowed.allowed)fail(409,allowed.reason+' Nothing was disclosed.');return consent;
}
export async function mockHip(p:Person,s:OrgState,consentId:string,hiu:{publicKey:string;nonce:string},now:string){
 const hip=await pair(),nonce=crypto.getRandomValues(new Uint8Array(32));
 const {key,iv}=await sessionKey(hip.privateKey,unb64(hiu.publicKey),nonce,unb64(hiu.nonce));
 const entries=[];
 for(const cc of p.careContexts??[]){
  const consent=(p.abdmConsents??[]).find(x=>x.id===consentId);if(!consent)fail(404,'Consent artefact not found.');
  const check=consentAllows(p,consentId,{hiType:cc.hiType,date:cc.recordDate,purpose:consent.purpose,...exchangeScope(s)},now);if(!check.allowed||cc.abhaNumber!==p.abha?.number)continue;
  const v=s.workspace.visits.find(x=>x.id===cc.visitId);if(!v||v.state!=='confirmed'||v.voidedAt||v.supersededBy)continue;
  // Slice 7c: each care context is sent as a FHIR document that must pass the pinned rule set first.
  const doc=fhirDocument(p,v,s.organisation.name,'Saha mock HIP');validateOutbound(doc,p.id.replace(/_/g,'-'),now);assertOutboundPrivacy(doc);assertPatientDocumentNotes(s,p.id,doc);const text=JSON.stringify(doc);
  entries.push({careContextId:cc.id,hiType:cc.hiType,recordDate:cc.recordDate,media:'application/fhir+json',checksum:await sha(text),content:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(text)))});
 }
 return {hipPublicKey:b64(await crypto.subtle.exportKey('raw',hip.publicKey)),hipNonce:b64(nonce),entries};
}
// HIU: decrypt with the session key, verify each checksum, and keep entries for human review.
export async function receive(hiuPrivate:CryptoKey,hiuNonce:Uint8Array,payload:Awaited<ReturnType<typeof mockHip>>){
 const {key,iv}=await sessionKey(hiuPrivate,unb64(payload.hipPublicKey),unb64(payload.hipNonce),hiuNonce);
 const out=[];for(const e of payload.entries){let text:string;try{text=new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv},key,buf(unb64(e.content))));}catch{fail(502,'A received entry could not be decrypted. Nothing was stored.');}
  if(await sha(text!)!==e.checksum)fail(502,'A received entry failed its checksum. Nothing was stored.');let bundle:any;try{bundle=JSON.parse(text!);}catch{fail(502,'A received entry is not valid JSON. Nothing was stored.');}
  if(bundle?.resourceType!=='Bundle')fail(502,'A received entry is not a FHIR Bundle. Nothing was stored.');let validation:ValidationStamp;try{validation=validateOutbound(bundle);}catch(err:any){fail(502,'A received entry failed validation. Nothing was stored. '+String(err?.message??''));}out.push({...e,bundle,validation:validation!});}
 return out;
}
export async function applyTransfer(s:OrgState,input:unknown,u:Actor,m:Member,now=new Date().toISOString()):Promise<any|null>{
 const parsed=transferSchema.safeParse(input);if(!parsed.success)return null;const c=parsed.data;authorizeTransfer(s,m,c);
 abdmOperation(s,c.type);
 const w=s.workspace,p=person(w,c.personId);if(p.version!==c.version)fail(409,'Patient changed. Refresh before continuing.');
 let detail='',result:any={ok:true};
 if(c.type==='abdmCareContextLink'){
  requireAbdmCapability(s,'hip','hip.publish');
  if(p.abha?.state!=='linked')fail(409,'Link an ABHA before linking care contexts.');
  const added:CareContext[]=[];for(const vid of c.visitIds){const v=w.visits.find(x=>x.id===vid&&x.personId===p.id);if(!v||v.state!=='confirmed'||v.voidedAt||v.supersededBy)fail(422,'Choose current confirmed visits of this patient.');
   if((p.careContexts??[]).some(x=>x.visitId===vid&&x.abhaNumber===p.abha!.number))continue;
   added.push({id:uuid(),visitId:vid,display:`OP consultation ${(v.confirmedAt??v.createdAt).slice(0,10)}`,hiType:'OPConsultation',recordDate:(v.facts.date||v.createdAt).slice(0,10),linkedAt:now,linkedBy:u.userId,abhaNumber:p.abha.number!});}
  if(!added.length)fail(409,'These visits are already linked as care contexts.');if((p.careContexts??[]).length+added.length>200)fail(422,'Care context limit reached.');
  (p.careContexts??=[]).push(...added);detail=`${added.length} care context${added.length>1?'s':''} linked to the ABHA on the mock gateway (HIP).`;result={linked:added.length};
 }
 else if(c.type==='abdmFetch'){
  requireAbdmCapability(s,'hiu','hiu.retrieve');
  const consent=(p.abdmConsents??[]).find(x=>x.id===c.consentId);if(!consent)fail(404,'Consent artefact not found.');if(effective(consent,now)!=='GRANTED')fail(409,`Consent is ${effective(consent,now)}; nothing can be fetched.`);
  if(!cfg?.modules.hiu||!cfg.approvals.some(a=>a.module==='hiu'))fail(409,'The ABDM HIU module is not enabled with a recorded approval for this organisation.');
  const consent=assertExchangeConsent(p,s,c.consentId,now);if(effective(consent,now)!=='GRANTED')fail(409,`Consent is ${effective(consent,now)}; nothing can be fetched.`);
  if((p.abdmTransfers??[]).length>=100)fail(422,'Transfer history limit reached for this patient.');
  const hiu=await pair(),nonce=crypto.getRandomValues(new Uint8Array(32));
  const payload=await mockHip(p,s,consent.id,{publicKey:b64(await crypto.subtle.exportKey('raw',hiu.publicKey)),nonce:b64(nonce)},now);
  // Consent and named parties can change while crypto is prepared. Recheck before decrypting and once more before storing.
  assertExchangeConsent(p,s,consent.id,now);const entries=await receive(hiu.privateKey,nonce,payload);assertExchangeConsent(p,s,consent.id,now);if((p.abdmReceived??[]).length+entries.length>200)fail(422,'Received-record limit reached for this patient; review and archive first.');const t:Transfer={id:uuid(),consentId:consent.id,requestedAt:now,requestedBy:u.userId,state:'delivered',entries:entries.length,acknowledgedAt:now,message:entries.length?'Entries decrypted, checksums verified, awaiting clinician review.':'No care context matched the consent.'};
  (p.abdmTransfers??=[]).push(t);for(const e of entries)(p.abdmReceived??=[]).push({id:uuid(),consentId:consent.id,transferId:t.id,careContextId:e.careContextId,hiType:e.hiType,recordDate:e.recordDate,checksum:e.checksum,bundle:e.bundle,validation:e.validation,state:'review',receivedAt:now});
  detail=`Mock HIU transfer under consent ${consent.purpose}: ${entries.length} encrypted entr${entries.length===1?'y':'ies'} received, decrypted and checksum-verified; held for review. Nothing is added to the record until reviewed.`;result={transferId:t.id,entries:entries.length};
 }
 else {
  const r=(p.abdmReceived??[]).find(x=>x.id===c.recordId);if(!r)fail(404,'Received record not found.');if(r.state!=='review')fail(409,'This received record is already reviewed.');
  Object.assign(r,{state:c.decision,reviewedBy:u.userId,reviewedAt:now,note:c.note});detail=`Received ${r.hiType} dated ${r.recordDate} ${c.decision} after review. ${c.note}`;
 }
 p.version++;w.audit.push({id:uuid(),at:now,actorId:u.userId,actor:u.displayName,role:m.role,action:c.type,subject:p.id,personId:p.id,detail});
 return result;
}
