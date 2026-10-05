// App presentation policy only. Server-bound package hashes and sync guards remain authoritative.
export function appGrantCurrent(payload,owner,now=Date.now()){
 const issued=Date.parse(payload?.issuedAt),expires=Date.parse(payload?.expiresAt);
 return !!owner&&payload?.userId===owner&&Number.isFinite(issued)&&Number.isFinite(expires)&&issued<=now+300000&&expires>now&&expires>issued&&expires-issued<=86400000;
}
export function appBookOwnerValid(book){return !!book?.userId&&(book.drafts??[]).every(d=>d.packet?.payload?.userId===book.userId)&&(book.registrations??[]).every(r=>r.userId===book.userId);}
