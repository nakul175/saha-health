import assert from 'node:assert/strict';
// Slice 6u (fourth independent review): the programme callback route through the built Worker. An unsigned callback
// naming an existing organisation and one naming no organisation get the same refusal, with no organisation read first.
export async function fourthReviewSmoke({check,org,base}){
 const body=organisationId=>JSON.stringify({organisationId,integrationId:'mis_none',submissionId:'s1',receipt:{contract:'saha-mis-v1',key:'k1',payloadHash:'a'.repeat(64),status:'accepted'}});
 const call=async organisationId=>{const r=await fetch(`${base}/api/mis/callback`,{method:'POST',headers:{'content-type':'application/json','x-saha-timestamp':String(Date.now()),'x-saha-signature':'0'.repeat(64)},body:body(organisationId)});return {status:r.status,text:await r.text()};};
 const known=await call(org),unknown=await call('org_does_not_exist');
 check(()=>{assert.equal(known.status,401,known.text);assert.equal(unknown.status,401,unknown.text);assert.equal(known.text,unknown.text);assert.match(known.text,/Callback not accepted/);});
}
