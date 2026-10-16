import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { federationEvent, federationDecision, federationCommand } from '../lib/saha/organisational-federation.ts';
const mapping=[{upstreamGroup:'district-asha',localRole:'asha',teamIds:['team-a']},{upstreamGroup:'district-clinical',localRole:'clinician',teamIds:['team-a']}];
const base={eventId:'11111111-1111-4111-8111-111111111111',source:'synthetic-approved-workforce',subjectAccountCode:'ABCDEF0123456789ABCDEF01',kind:'groups-changed',groups:['district-asha'],occurredAt:'2026-10-16T00:00:00.000Z',mappingVersion:3,mappings:mapping,reason:'Synthetic qualification event'};
const member={userId:'worker-a',accountCode:base.subjectAccountCode,role:'clinician',status:'active',version:7,isOwner:false,teamIds:['team-old']};
const event=federationEvent.parse(base);
assert.deepEqual(federationDecision(event),{outcome:'apply',role:'asha',teamIds:['team-a'],groups:['district-asha']});
const positive=federationCommand(member,event);assert.equal(positive.status,'active');assert.equal(positive.role,'asha');assert.equal(positive.version,7);
const removed=federationCommand(member,federationEvent.parse({...base,kind:'membership-removed',groups:[]}));assert.equal(removed.status,'suspended');assert.equal(removed.role,'clinician');assert.deepEqual(removed.teamIds,['team-old']);
for(const groups of [['unknown'],['district-asha','unknown']]){const c=federationCommand(member,federationEvent.parse({...base,groups}));assert.equal(c.status,'suspended');assert.equal(c.decision.reason,'unmapped-group');}
const conflict=federationCommand(member,federationEvent.parse({...base,groups:['district-asha','district-clinical']}));assert.equal(conflict.status,'suspended');
assert.throws(()=>federationCommand({...member,isOwner:true},event),/owner/);
assert.throws(()=>federationCommand({...member,status:'removed'},event),/cannot be restored/);
assert.equal(federationEvent.safeParse({...base,kind:'membership-removed',groups:['district-asha']}).success,false);
assert.equal(federationEvent.safeParse({...base,mappings:[mapping[0],mapping[0]]}).success,false);
const stale=federationCommand({...member,version:8},event);assert.equal(stale.version,8,'current version is bound for the existing command CAS');
assert.equal(base.subjectAccountCode.length,24,'tenant lookup uses exact account code inside explicit organisation');
const server=readFileSync(new URL('../lib/saha/organisational-federation-server.ts',import.meta.url),'utf8');
for(const guard of ["environmentOf(runtime()).name","x-saha-organisation","x-saha-operation-actor","is_owner !== 1","sec-fetch-site","subjectAccountCode","event.subjectAccountCode","event.eventId","command(new Request","digest(event)"]){assert.ok(server.includes(guard),`server retains ${guard}`);}
assert.match(server,/WHERE m\.org_id=\? AND a\.account_code=\?/,'target lookup is tenant-bound');
assert.match(server,/SELECT 1 AS ok FROM teams WHERE org_id=\? AND id=\?/,'mapped team is tenant-bound');
console.log('organisational federation contract: 24/24 passed');
