import {seal,writeVault} from './vault.js';
export const OFFLINE_OPEN_LIMIT=2000;
const metadataError=()=>Error('Offline access evidence could not be saved. Keep the notebook locked and reconnect.');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,ref=/^[a-zA-Z0-9_-]{1,200}$/,hash=/^[0-9a-f]{64}$/;
export function pendingOfflineOpens(book){return (book?.offlineOpens??[]).length>0;}
export function validOfflineOpen(e){
 if(!e||!uuid.test(e.id)||!ref.test(e.organisationId)||!['app','field'].includes(e.surface)||typeof e.claimedAt!=='string'||e.claimedAt.length>40||!Number.isFinite(Date.parse(e.claimedAt)))return false;
 const kind=e.kind,common=['claimedAt','count','id','kind','organisationId','presentation','surface'];let keys,presentations,valid;
 if(kind==='prepared'){keys=['leaseId','packageHash'];presentations=['notebook-unlock','record-entry'];valid=ref.test(e.leaseId)&&hash.test(e.packageHash);}
 else if(kind==='accepted-registration'){keys=['registrationId',...(e.receiptKey!==undefined?['receiptKey','bodyHash']:[])];presentations=['notebook-unlock','registration-entry'];valid=uuid.test(e.registrationId)&&(e.receiptKey===undefined&&e.bodyHash===undefined||ref.test(e.receiptKey)&&hash.test(e.bodyHash));}
 else if(kind==='match-candidates'){keys=['copyId'];presentations=['notebook-unlock','match-candidates'];valid=hash.test(e.copyId);}
 else if(kind==='local-registration'){keys=['localId','contentHash','status'];presentations=['notebook-unlock','registration-entry','registration-form'];valid=uuid.test(e.localId)&&hash.test(e.contentHash)&&['unsent','unknown'].includes(e.status);}
 else if(kind==='accepted-mapping'){keys=['openId','registrationId','receiptKey','bodyHash'];presentations=['accepted-mapping'];valid=uuid.test(e.openId)&&uuid.test(e.registrationId)&&ref.test(e.receiptKey)&&hash.test(e.bodyHash);}
 else return false;
 return valid&&e.count===(kind==='accepted-mapping'?0:1)&&presentations.includes(e.presentation)&&Object.keys(e).sort().join(',')===[...common,...keys].sort().join(',');
}
function validateQueue(book){const queue=book.offlineOpens??[];if(!Array.isArray(queue)||queue.length>OFFLINE_OPEN_LIMIT||queue.some(e=>!validOfflineOpen(e))||new Set(queue.map(e=>e.id)).size!==queue.length)throw metadataError();return queue;}
async function store(book,key,salt,revision,write){let nextRevision;try{nextRevision=await write({...await seal(key,book),salt},revision);}catch(error){const failure=error instanceof Error?error:Error(String(error));failure.offlineStorageFailure=true;throw failure;}return {book,revision:nextRevision};}

// The caller must await this CAS before displaying a new name list or record.
// Rendering and ordinary saves never manufacture events.
export async function queueOfflinePresentations(value,key,salt,revision,drafts,surface,presentation,{write=writeVault,now=()=>new Date().toISOString()}={}){
 const refs=[];for(const d of drafts){const p=d.packet?.payload;if(!value.userId||p?.userId!==value.userId)throw metadataError();refs.push({kind:'prepared',organisationId:p.organisationId,leaseId:p.leaseId,packageHash:d.packageHash});}
 return queueOfflineMetadata(value,key,salt,revision,refs,surface,presentation,{write,now});
}
export async function queueOfflineMetadata(value,key,salt,revision,references,surface,presentation,{write=writeVault,now=()=>new Date().toISOString()}={}){
 const queue=validateQueue(value),links=validateLinks(value),refs=[...new Map(references.map(r=>[JSON.stringify(r),r])).values()];if(!value.userId&&(queue.length||refs.length))throw metadataError();
 if(queue.length+refs.length>OFFLINE_OPEN_LIMIT||links.length+queue.filter(e=>e.kind==='local-registration').length+refs.filter(e=>e.kind==='local-registration').length>OFFLINE_OPEN_LIMIT)throw Error('Offline access evidence is full. Reconnect to record it before opening more patient copies.');
 const next=structuredClone(value);next.offlineOpens=[...queue];for(const reference of refs){const event={...reference,id:crypto.randomUUID(),surface,presentation,count:reference.kind==='accepted-mapping'?0:1,claimedAt:now()};if(!validOfflineOpen(event))throw metadataError();next.offlineOpens.push(event);}
 if(!refs.length)return {book:next,revision};return store(next,key,salt,revision,write);
}
export async function localRegistrationReference(organisationId,localId,value,status='unsent'){return {kind:'local-registration',organisationId,localId,status,contentHash:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)))),x=>x.toString(16).padStart(2,'0')).join('')};}
function validateLinks(book){const links=book.offlineOpenLinks??[];if(!Array.isArray(links)||links.length>OFFLINE_OPEN_LIMIT||new Set(links.map(x=>x.openId)).size!==links.length||links.some(x=>Object.keys(x).sort().join(',')!=='contentHash,localId,openId,organisationId'||!uuid.test(x.openId)||!uuid.test(x.localId)||!hash.test(x.contentHash)||!ref.test(x.organisationId)))throw metadataError();return links;}
// A mapping appends explicit exact-receipt correlation; the earlier unknown
// presentation remains immutable and is never counted as another display.
export async function queueAcceptedOpenMappings(value,key,salt,revision,surface,{write=writeVault,now=()=>new Date().toISOString()}={}){
 const refs=[],links=validateLinks(value),sources=[...(value.registrations??[]).map(r=>({id:r.id,org:r.organisationId,receipts:r.receiptReferences??[]})),...(value.registrationDeletions??[]).map(t=>({id:t.registrationId,org:t.organisationId,receipts:t.receipts??[]}))];
 for(const link of links){if((value.offlineOpens??[]).some(e=>e.kind==='accepted-mapping'&&e.openId===link.openId))continue;const receipt=sources.find(s=>s.id===link.localId&&s.org===link.organisationId)?.receipts.find(r=>r.outcome==='accepted');if(receipt)refs.push({kind:'accepted-mapping',organisationId:link.organisationId,openId:link.openId,registrationId:link.localId,receiptKey:receipt.key,bodyHash:receipt.bodyHash});}
 return queueOfflineMetadata(value,key,salt,revision,refs,surface,'accepted-mapping',{write,now});
}

// Upload fixed historical reports only. A receipt does not send, confirm,
// renew or reauthorize a care command, and no absent receipt means failure.
export async function flushOfflineOpens(value,key,salt,revision,{fetcher=fetch,write=writeVault,onProgress=()=>{}}={}){
 let book=structuredClone(value);const queue=validateQueue(book);validateLinks(book);if(typeof book.userId!=='string'||book.userId.length<1||book.userId.length>200)throw metadataError();const groups=new Map();
 for(const event of queue){const list=groups.get(event.organisationId)??[];list.push(event);groups.set(event.organisationId,list);}
 for(const [org,events] of groups){const batches=[];let batch=[];for(const event of events){const proposed=[...batch,event],bytes=new TextEncoder().encode(JSON.stringify({expectedActorId:book.userId,events:proposed.map(({organisationId,...value})=>value)})).byteLength;if(batch.length&&(proposed.length>20||bytes>12000)){batches.push(batch);batch=[];}batch.push(event);}if(batch.length)batches.push(batch);for(const batch of batches){
  const body={expectedActorId:book.userId,events:batch.map(({organisationId,...event})=>event)};let response;
  try{response=await fetcher('/api/offline-opens',{method:'POST',cache:'no-store',redirect:'error',headers:{'Content-Type':'application/json','x-saha-organisation':org},body:JSON.stringify(body)});}catch{throw Error('Offline access reports are pending. Keep their encrypted keys for the same retry.');}
  if(!response.ok)throw Error('Offline access report was refused. Keep its encrypted evidence and sign in as its original worker.');
  let result;try{result=await response.json();}catch{throw metadataError();}
  const expected=batch.map(e=>e.id).sort();if(result.userId!==book.userId||!Array.isArray(result.accepted)||JSON.stringify([...result.accepted].sort())!==JSON.stringify(expected))throw metadataError();
  const accepted=new Set(expected),next=structuredClone(book);next.offlineOpens=next.offlineOpens.filter(e=>!accepted.has(e.id));next.offlineOpenLinks??=[];
  for(const e of batch){if(e.kind==='local-registration'&&!next.offlineOpenLinks.some(x=>x.openId===e.id))next.offlineOpenLinks.push({openId:e.id,organisationId:e.organisationId,localId:e.localId,contentHash:e.contentHash});if(e.kind==='accepted-mapping')next.offlineOpenLinks=next.offlineOpenLinks.filter(x=>x.openId!==e.openId);}
  validateLinks(next);const saved=await store(next,key,salt,revision,write);book=saved.book;revision=saved.revision;onProgress(saved);
 }}
 return {book,revision};
}
