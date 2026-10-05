import assert from 'node:assert/strict';

// A real acquired draft gives smoke/role controls a valid exact source URL.
// The author can inspect it; no clinician review or activation is fabricated.
export async function acquireSyntheticSource(api,who,org,tag){
 const snapshot=await api.get(who,'/api/workspace',org);assert.equal(snapshot.status,200,snapshot.text);
 const s=snapshot.json,now=new Date(),reviewBy=new Date(now.getTime()+30*86400000).toISOString().slice(0,10);
 const created=await api.command(who,{type:'createGovernance',spec:{kind:'source',key:'synthetic-'+tag,title:'Synthetic source fixture',ownerId:s.user.userId,teamIds:[s.teams[0].id],effectiveFrom:now.toISOString().slice(0,10),reviewBy,changeSummary:'Synthetic exact-source route control; independent review remains pending.',publisher:'Synthetic fixture publisher',edition:'fixture-1',url:'https://example.invalid/'+tag,applicability:'Synthetic testing only, no clinical advice.',summary:'Synthetic controlled acquisition fixture.'}},org);
 assert.equal(created.status,200,created.text);
 const result=await api.call(who,'/api/clinical-sources',{method:'POST',org,headers:{'Idempotency-Key':crypto.randomUUID()},body:{acquisition:'synthetic-upload',entryId:created.json.result.entryId,version:1,mime:'text/plain',content:'SYNTHETIC DOCUMENT FIXTURE ONLY. NO PATIENT OR CLINICAL CONTENT.',expiresAt:new Date(now.getTime()+86400000).toISOString(),licenceReference:'SYNTHETIC-PENDING-LICENSING'}});
 assert.equal(result.status,200,result.text);
 return '?entryId='+encodeURIComponent(result.json.entryId)+'&sha256='+result.json.document.sha256;
}
