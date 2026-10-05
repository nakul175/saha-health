import type { D1Database } from '@cloudflare/workers-types';
import { digest, fail } from './core';
import { ABHA_REVIEW_LIMIT } from './abdm';

// Protection state only: no ABHA number, patient id, contact detail or raw caller key is stored.
// One SQL statement admits each lookup; D1 serialises its count and insert. Pending attempts
// consume capacity as well as refused ones, including when a process or its audit write fails.
export async function reserveAbhaReview(db:D1Database,orgId:string,userId:string,key:string,payload:unknown,number:string,now=new Date().toISOString()){
 const [attemptHash,payloadHash,probeHash]=await Promise.all([digest(['abha-attempt',key]),digest(payload),digest(['abha-probe',orgId,userId,number])]);
 const since=new Date(Date.parse(now)-86400000).toISOString();
 const results=await db.batch([
  db.prepare('DELETE FROM abha_review_reservations WHERE org_id=? AND user_id=? AND at<?').bind(orgId,userId,since),
  db.prepare(`INSERT OR IGNORE INTO abha_review_reservations (org_id,user_id,attempt_hash,payload_hash,probe_hash,at)
   SELECT ?,?,?,?,?,? WHERE
   (SELECT count(*) FROM abha_review_reservations WHERE org_id=? AND user_id=? AND at>=?) +
   (SELECT count(*) FROM (SELECT MIN(id) AS id FROM audit_events WHERE org_id=? AND actor_id=? AND action='abhaLinkReview' AND at>=? GROUP BY person_id) legacy
    WHERE legacy.id NOT IN (SELECT review_event_id FROM abha_review_reservations WHERE org_id=? AND user_id=? AND review_event_id IS NOT NULL)) < ?`)
   .bind(orgId,userId,attemptHash,payloadHash,probeHash,now,orgId,userId,since,orgId,userId,since,orgId,userId,ABHA_REVIEW_LIMIT),
 ]);
 const saved=await db.prepare('SELECT payload_hash FROM abha_review_reservations WHERE org_id=? AND user_id=? AND attempt_hash=?').bind(orgId,userId,attemptHash).first<{payload_hash:string}>();
 if(saved&&saved.payload_hash!==payloadHash)fail(409,'This operation key was already used for different input.');
 // A concurrent or refused retry is refused generically, rather than repeating an uncertain lookup.
 return {acquired:results[1].meta.changes===1,attemptHash};
}
export async function releaseAbhaReview(db:D1Database,orgId:string,userId:string,attemptHash:string){
 await db.prepare('DELETE FROM abha_review_reservations WHERE org_id=? AND user_id=? AND attempt_hash=?').bind(orgId,userId,attemptHash).run();
}
export async function recordAbhaReviewReservation(db:D1Database,orgId:string,userId:string,attemptHash:string,eventId:string){
 // Do not double-count the chained steward event and its reservation. Between event creation
 // and this update the count is conservative, never permissive. MIN(id) matches legacy counting.
 await db.prepare('UPDATE abha_review_reservations SET review_event_id=? WHERE org_id=? AND user_id=? AND attempt_hash=?').bind(eventId,orgId,userId,attemptHash).run();
}
