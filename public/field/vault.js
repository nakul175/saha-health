// Only ciphertext, random salt/IV and a revision counter are stored in IndexedDB.
export async function derive(passphrase,salt){
 if(passphrase.length<12)throw Error('Use at least 12 characters. / कम से कम 12 अक्षर लिखें।');
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(passphrase),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',hash:'SHA-256',salt:new Uint8Array(salt),iterations:310000},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export async function seal(key,value){const iv=crypto.getRandomValues(new Uint8Array(12));const bytes=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('saha-field-v1')},key,new TextEncoder().encode(JSON.stringify(value)));return {iv:Array.from(iv),cipher:Array.from(new Uint8Array(bytes))};}
export async function unseal(key,record){return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv),additionalData:new TextEncoder().encode('saha-field-v1')},key,new Uint8Array(record.cipher))));}
export async function verifyPacket(packet){const key=await crypto.subtle.importKey('jwk',packet.publicKey,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,new Uint8Array(packet.signature),new TextEncoder().encode(JSON.stringify(packet.payload)));}
export async function packetHash(packet){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(packet)))),x=>x.toString(16).padStart(2,'0')).join('');}
export function openVault(){return new Promise((resolve,reject)=>{const r=indexedDB.open('saha-field-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('vault');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function readVault(){const db=await openVault();return new Promise((resolve,reject)=>{const tx=db.transaction('vault','readonly'),r=tx.objectStore('vault').get('encrypted');tx.oncomplete=()=>{db.close();resolve(r.result??null)};tx.onerror=()=>{db.close();reject(tx.error)};});}
export async function writeVault(value,expected){const db=await openVault();return new Promise((resolve,reject)=>{const tx=db.transaction('vault','readwrite'),store=tx.objectStore('vault'),r=store.get('encrypted');let conflict=false,settled=false;r.onsuccess=()=>{if((r.result?.revision??0)!==expected){conflict=true;tx.abort();return;}store.put({...value,revision:expected+1},'encrypted');};tx.oncomplete=()=>{settled=true;db.close();resolve(expected+1)};const failed=()=>{if(settled)return;settled=true;const cause=tx.error,risk=conflict?'Another tab changed this vault. Lock and reopen before editing.':cause?.name==='QuotaExceededError'?'Device storage is full. Nothing was saved. Free space and retry.':'Device database save failed. Nothing was acknowledged; keep this page open and retry.',error=Error(risk);if(cause?.name)error.name=cause.name;db.close();reject(error);};tx.onabort=tx.onerror=failed;});}
// Deleting the notebook clears the whole store: the sealed notebook and every sealed media item.
export async function deleteVault(){const db=await openVault();return new Promise((resolve,reject)=>{const tx=db.transaction('vault','readwrite');tx.objectStore('vault').clear();tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>{db.close();reject(tx.error)};});}
// Slice 3a: queued photos and voice notes are sealed one by one under their own keys, so the
// notebook itself stays small and is not re-encrypted with media on every keystroke.
const MEDIA_AD=new TextEncoder().encode('saha-field-media-v1');
export async function sealBytes(key,bytes){const iv=crypto.getRandomValues(new Uint8Array(12));return {iv:Array.from(iv),cipher:new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:MEDIA_AD},key,bytes))};}
export async function unsealBytes(key,record){return new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:new Uint8Array(record.iv),additionalData:MEDIA_AD},key,record.cipher));}
function mediaTx(mode,fn){return openVault().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction('vault',mode),r=fn(tx.objectStore('vault'));tx.oncomplete=()=>{db.close();resolve(r?.result??null)};tx.onabort=tx.onerror=()=>{db.close();reject(tx.error??Error('Device media storage failed.'))};}));}
export const writeMedia=(id,value)=>mediaTx('readwrite',store=>{store.put(value,'media:'+id)});
export const readMedia=id=>mediaTx('readonly',store=>store.get('media:'+id));
export const deleteMedia=id=>mediaTx('readwrite',store=>{store.delete('media:'+id)});
export const listMediaIds=()=>mediaTx('readonly',store=>store.getAllKeys()).then(keys=>(keys??[]).filter(k=>typeof k==='string'&&k.startsWith('media:')).map(k=>k.slice(6)));
// Replace the sealed notebook and delete named sealed media in one revision-checked transaction.
// A failed or aborted transaction changes neither copy; callers acknowledge only its completion.
export async function purgeVault(value,expected,mediaIds){
 if(!Array.isArray(mediaIds)||mediaIds.length>100||mediaIds.some(id=>typeof id!=='string'||id.length>200))throw Error('Invalid device purge references.');
 const db=await openVault();return new Promise((resolve,reject)=>{const tx=db.transaction('vault','readwrite'),store=tx.objectStore('vault'),r=store.get('encrypted');let conflict=false;r.onsuccess=()=>{if((r.result?.revision??0)!==expected){conflict=true;tx.abort();return;}store.put({...value,revision:expected+1},'encrypted');for(const id of mediaIds)store.delete('media:'+id);};tx.oncomplete=()=>{db.close();resolve(expected+1);};tx.onabort=tx.onerror=()=>{db.close();reject(Error(conflict?'Another tab changed this vault. Lock and reopen before deletion.':'Device purge transaction failed.'));};});
}
