// App presentation policy only. Server-bound package hashes and sync guards remain authoritative.
// A connected check records both wall time and the browser process's monotonic clock. Offline
// access then advances time monotonically. A browser/device restart changes timeOrigin and must
// be checked online before private material is shown again.
export function appAuthorityAnchor(serverNow=Date.now(),monotonic=globalThis.performance?.now?.(),timeOrigin=globalThis.performance?.timeOrigin){
 if(!Number.isFinite(serverNow)||!Number.isFinite(monotonic)||!Number.isFinite(timeOrigin))return null;
 return {schema:1,serverNow,monotonic,timeOrigin};
}
export function appAuthorityNow(anchor,wallNow=Date.now(),monotonic=globalThis.performance?.now?.(),timeOrigin=globalThis.performance?.timeOrigin){
 if(!anchor||anchor.schema!==1||![anchor.serverNow,anchor.monotonic,anchor.timeOrigin,wallNow,monotonic,timeOrigin].every(Number.isFinite))return null;
 if(timeOrigin!==anchor.timeOrigin||monotonic<anchor.monotonic)return null;
 const elapsed=monotonic-anchor.monotonic;
 // A forward wall-clock correction is conservative. A rollback can never extend the lease.
 return Math.max(wallNow,anchor.serverNow+elapsed);
}
export function appGrantCurrent(payload,owner,now=Date.now(),authority=null,monotonic=globalThis.performance?.now?.(),timeOrigin=globalThis.performance?.timeOrigin){
 const issued=Date.parse(payload?.issuedAt),expires=Date.parse(payload?.expiresAt);
 if(authority){now=appAuthorityNow(authority,now,monotonic,timeOrigin);if(now===null)return false;}
 return !!owner&&payload?.userId===owner&&Number.isFinite(issued)&&Number.isFinite(expires)&&issued<=now+300000&&expires>now&&expires>issued&&expires-issued<=86400000;
}
export function appBookOwnerValid(book){return !!book?.userId&&(book.drafts??[]).every(d=>d.packet?.payload?.userId===book.userId)&&(book.registrations??[]).every(r=>r.userId===book.userId);}

// A positive connected refusal overrides a signed offline grant. A failed transport
// keeps bounded offline access available; never interpret a refused response as offline.
export async function appValidateOnlineBook(book,fetcher=fetch,requireConnected=false){
 let verifiedServerNow=null;
 const read=async(path,org)=>{let r;try{r=await fetcher(path,{cache:'no-store',redirect:'manual',headers:org?{'x-saha-organisation':org}:{}})}catch(error){if(error instanceof TypeError&&!requireConnected)return null;throw error}
  if(!r.ok||r.type==='opaqueredirect'||(r.status>=300&&r.status<400))throw Error('Device visit access changed. Reconnect with your care team before opening it.');
  const header=Date.parse(r.headers?.get?.('date')??'');if(Number.isFinite(header))verifiedServerNow=Math.max(verifiedServerNow??header,header);
  let s;try{s=await r.json()}catch{throw Error('Device visit access could not be verified.');}return s;};
 const current=await read('/api/workspace');if(!current)return;
 if(!['asha','clinician'].includes(current.role))throw Error('A care role is required.');
 if(book.userId&&current.user?.userId!==book.userId)throw Error('This notebook belongs to another account. Lock it; do not sync.');
 book.userId??=current.user?.userId;
 const refs=[...new Map((book.drafts??[]).filter(d=>appGrantCurrent(d.packet.payload,book.userId)).map(d=>{const p=d.packet.payload;return [JSON.stringify([p.organisationId,p.personId]),p]})).values()];
 for(let i=0;i<refs.length;i+=4)await Promise.all(refs.slice(i,i+4).map(async p=>{
  const s=await read('/api/patients/detail?personId='+encodeURIComponent(p.personId),p.organisationId);if(!s)return;
  if(s.delta?.user?.userId!==book.userId||!['asha','clinician'].includes(s.delta?.role)||s.delta?.organisation?.id!==p.organisationId||!s.delta?.people?.some(x=>x.id===p.personId))throw Error('Device visit access changed. Reconnect with your care team before opening it.');
 }));
 // HTTPS response time is preferred; local/synthetic harnesses without a Date header use the
 // successful current online verification time. The signed packet still bounds every lease.
 const candidate=appAuthorityAnchor(verifiedServerNow??Date.now());
 // Two reconnect checks may overlap. An older response finishing last must not roll the trusted
 // server anchor backwards and extend any grant.
 if(candidate&&(!book.authorityClock||candidate.serverNow>=book.authorityClock.serverNow))book.authorityClock=candidate;
}
