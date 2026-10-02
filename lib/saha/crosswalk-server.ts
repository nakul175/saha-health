import type { D1Database } from '@cloudflare/workers-types';
import { fail } from './core';
import { recordAccesses } from './access-audit';
import { applyCrosswalk, IDENTIFIER_REFUSED, IdentifierHeldElsewhere } from './crosswalk';
import type { Actor } from './store';
import type { Member, OrgState } from './types';

// Slice 10e: an identifier link refused because a record outside the requester's care scope holds the identifier is recorded
// for identity steward review as an audit event on the holding record (visible only to members who may see it), then refused
// with the same text as any other refusal that must not say why. Recording is best effort: the requester's answer is the same
// either way. The oracle this leaves (a refused link versus a recorded one tells the requester that someone outside their
// scope holds a value they typed) is bounded as for ABHA numbers (slice 6ab): one review event per requester and holding
// record a day, and after IDENTIFIER_REVIEW_LIMIT such refusals in a day every further link by that requester is refused
// the same way, so repeated probing reveals nothing more until the day has passed.
export const IDENTIFIER_REVIEW_LIMIT=3;
export async function crosswalkWithReview(db:D1Database,state:OrgState,c:any,u:Actor,m:Member,now=new Date().toISOString()){
 const link=c?.type==='identifierLink',since=new Date(Date.parse(now)-86400000).toISOString();
 const reviews=async()=>link?(await db.prepare("SELECT DISTINCT person_id FROM audit_events WHERE org_id=? AND actor_id=? AND action='identifierConflictReview' AND at>=?").bind(state.organisation.id,u.userId,since).all<{person_id:string}>()).results.map(r=>r.person_id):[];
 if(link&&(await reviews()).length>=IDENTIFIER_REVIEW_LIMIT){try{applyCrosswalk(structuredClone(state),c,u,m,now);}catch(e){if(!(e instanceof IdentifierHeldElsewhere))throw e;}fail(422,IDENTIFIER_REFUSED);}
 try{return applyCrosswalk(state,c,u,m,now);}
 catch(e){if(!(e instanceof IdentifierHeldElsewhere))throw e;
  try{if(!(await reviews()).includes(e.heldBy))await recordAccesses(db,state,u,m,[{action:'identifierConflictReview',subject:e.heldBy,personId:e.heldBy,detail:`An identifier link on record ${e.personId} was refused because this record holds the same identifier. An identity steward should review whether the two records are the same person. The requester was shown the ordinary refusal. Recorded on this record only; repeats by the same requester within a day are not recorded again.`}],now);}catch{/* recordAccesses has logged the failure without content */}
  fail(422,IDENTIFIER_REFUSED);}
}
