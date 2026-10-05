// App presentation policy only. Server-bound package hashes and sync guards remain authoritative.
export function appGrantCurrent(payload,owner,now=Date.now()){
 const issued=Date.parse(payload?.issuedAt),expires=Date.parse(payload?.expiresAt);
 return !!owner&&payload?.userId===owner&&Number.isFinite(issued)&&Number.isFinite(expires)&&issued<=now+300000&&expires>now&&expires>issued&&expires-issued<=86400000;
}
export function appBookOwnerValid(book){return !!book?.userId&&(book.drafts??[]).every(d=>d.packet?.payload?.userId===book.userId)&&(book.registrations??[]).every(r=>r.userId===book.userId);}

// A positive connected refusal overrides a signed offline grant. A failed transport
// keeps bounded offline access available; never interpret a refused response as offline.
export async function appValidateOnlineBook(book,fetcher=fetch,requireConnected=false){
 const read=async(path,org)=>{let r;try{r=await fetcher(path,{cache:'no-store',redirect:'manual',headers:org?{'x-saha-organisation':org}:{}})}catch(error){if(error instanceof TypeError&&!requireConnected)return null;throw error}
  if(!r.ok||r.type==='opaqueredirect'||(r.status>=300&&r.status<400))throw Error('Device visit access changed. Reconnect with your care team before opening it.');
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
}
