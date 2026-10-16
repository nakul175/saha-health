import { createBackup, restoreBackup, inventory } from '../scripts/recovery.mjs';
import { globSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createDecipheriv, pbkdf2Sync, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
// Slice 11a: the restored Worker's port can be set (SAHA_RESTORE_PORT, default 8788) so the runner can keep every suite on its own ports.
const RESTORE_PORT=process.env.SAHA_RESTORE_PORT??'8788';
const source=globSync('.wrangler/test-state/v3/d1/**/*.sqlite').find(p=>!p.endsWith('/metadata.sqlite'));if(!source)throw Error('Run local API/database tests first.');
const temp=mkdtempSync(join(process.cwd(),'.wrangler/recovery-drill-')),file=join(temp,'snapshot.sahabackup'),state=join(temp,'restored'),target=join(state,relative('.wrangler/test-state',source)),pass=randomBytes(32).toString('hex');let passed=0,worker,output='';const check=fn=>{fn();passed++};
// Plaintext must be absent from the backup's structured metadata and present only after the
// passphrase authenticates the ciphertext. Salt, IV, tag and ciphertext are high-entropy: a short
// word such as "Meena" can occur in their base64 text, or in the decoded ciphertext bytes, by chance.
// CI run 36949357077 failed on readFileSync(file).includes('Meena') and passed on a rerun.
function assertEnvelopeHidesPlaintext(snapshot, baseline){
 assert.ok(readFileSync(source).includes('Meena'), 'the source database contains the plaintext name this check guards');
 const env=JSON.parse(readFileSync(snapshot,'utf8'));
 assert.deepEqual(Object.keys(env).sort(),['ciphertext','format','iterations','iv','kdf','salt','tag']);
 assert.equal(env.format,'saha-recovery-v1');assert.equal(env.kdf,'PBKDF2-SHA256');
 assert.equal(Buffer.from(env.salt,'base64').length,32);assert.equal(Buffer.from(env.iv,'base64').length,12);assert.equal(Buffer.from(env.tag,'base64').length,16);
 const clear=JSON.stringify({format:env.format,kdf:env.kdf,iterations:env.iterations});
 for(const word of ['Meena','schemaSha256',baseline.schemaSha256])assert.equal(clear.includes(word),false,word);
 const key=pbkdf2Sync(pass,Buffer.from(env.salt,'base64'),env.iterations,32,'sha256');
 try{
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(env.iv,'base64'));decipher.setAAD(Buffer.from('saha-recovery-v1'));decipher.setAuthTag(Buffer.from(env.tag,'base64'));
  const payload=JSON.parse(Buffer.concat([decipher.update(Buffer.from(env.ciphertext,'base64')),decipher.final()]).toString());
  assert.equal(payload.manifest.schemaSha256,baseline.schemaSha256);
  assert.ok(Buffer.from(payload.database,'base64').includes('Meena'), 'the plaintext name is inside the authenticated ciphertext');
 }finally{key.fill(0);}
}
try{
 const baseline=inventory(source);
 const leakTrials=Number(process.env.SAHA_LEAK_TRIALS||0);
 if(leakTrials>0){
  let rawHits=0;
  for(let i=0;i<leakTrials;i++){
   const trial=join(temp,`trial-${i}.sahabackup`);
   await createBackup(source,trial,pass);
   assertEnvelopeHidesPlaintext(trial,baseline);
   const raw=readFileSync(trial,'utf8');
   if(raw.includes('Meena')||raw.includes('schemaSha256'))rawHits++;
   rmSync(trial);
  }
  console.log(JSON.stringify({trials:leakTrials,deterministicPasses:leakTrials,rawFileSubstringHits:rawHits}));
 }else{
 const created=await createBackup(source,file,pass);passed++;
 check(()=>{assert.equal(created.tables,Object.keys(baseline.tables).length);assertEnvelopeHidesPlaintext(file,baseline);});
 await assert.rejects(()=>createBackup(source,file,pass),/already exists/);passed++;
 await assert.rejects(()=>restoreBackup(file,join(temp,'wrong.sqlite'),'incorrect-backup-passphrase'),/authenticate/);passed++;
 const tampered=JSON.parse(readFileSync(file,'utf8')),bytes=Buffer.from(tampered.ciphertext,'base64');bytes[10]^=1;tampered.ciphertext=bytes.toString('base64');writeFileSync(join(temp,'tampered.sahabackup'),JSON.stringify(tampered));await assert.rejects(()=>restoreBackup(join(temp,'tampered.sahabackup'),join(temp,'tampered.sqlite'),pass));passed++;
 check(()=>{assert.equal(existsSync(join(temp,'wrong.sqlite')),false);assert.equal(existsSync(join(temp,'tampered.sqlite')),false)});
 const restored=await restoreBackup(file,target,pass);passed++;check(()=>{assert.equal(restored.verified,true);assert.deepEqual(inventory(target),baseline)});
 await assert.rejects(()=>restoreBackup(file,target,pass),/already exists/);passed++;
 const db=new DatabaseSync(target);const actor=db.prepare("SELECT a.user_id,a.active_org_id FROM accounts a JOIN memberships m ON m.user_id=a.user_id AND m.org_id=a.active_org_id JOIN pilot p ON p.org_id=a.active_org_id JOIN outreach o ON o.org_id=a.active_org_id JOIN expansions e ON e.org_id=a.active_org_id JOIN governance g ON g.org_id=a.active_org_id WHERE a.user_id LIKE 'r1-%-owner' AND m.status='active' ORDER BY a.created_at DESC LIMIT 1").get();assert.ok(actor);const pilotBefore=JSON.parse(db.prepare('SELECT data FROM pilot WHERE org_id=?').get(actor.active_org_id).data);const outreachBefore=JSON.parse(db.prepare('SELECT data FROM outreach WHERE org_id=?').get(actor.active_org_id).data),expansionsBefore=JSON.parse(db.prepare('SELECT data FROM expansions WHERE org_id=?').get(actor.active_org_id).data);const continuityBefore=db.prepare('SELECT data FROM patients WHERE org_id=?').all(actor.active_org_id).map(r=>JSON.parse(r.data)).filter(p=>p.identityReview||p.assignmentHistory?.length).map(p=>({id:p.id,identityReview:p.identityReview,assignmentHistory:p.assignmentHistory})).sort((a,b)=>a.id.localeCompare(b.id));const checksBefore=db.prepare('SELECT data FROM visits WHERE org_id=?').all(actor.active_org_id).map(r=>JSON.parse(r.data)).filter(v=>v.patientCheck).map(v=>({id:v.id,patientCheck:v.patientCheck})).sort((a,b)=>a.id.localeCompare(b.id));check(()=>{assert.ok(continuityBefore.some(p=>p.assignmentHistory?.some(h=>h.acknowledgement)));assert.ok(continuityBefore.some(p=>p.identityReview?.state==='resolved'));assert.ok(checksBefore.length>0)});const governanceBefore=JSON.parse(db.prepare('SELECT data FROM governance WHERE org_id=?').get(actor.active_org_id).data);check(()=>{assert.ok(governanceBefore.entries.length>0);assert.ok(governanceBefore.evaluations.some(e=>e.state==='completed'));assert.ok(governanceBefore.safety.some(c=>c.state==='closed'))});const oldReceipt=db.prepare('SELECT count(*) AS n FROM command_receipts WHERE org_id=?').get(actor.active_org_id).n;
 check(()=>assert.throws(()=>db.prepare('DELETE FROM audit_events WHERE org_id=?').run(actor.active_org_id),/append-only/));check(()=>assert.throws(()=>db.prepare('UPDATE record_revisions SET reason=? WHERE org_id=?').run('forbidden',actor.active_org_id),/append-only/));db.close();
 const ready=new Promise((resolve,reject)=>{worker=spawn(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','dev','--config','dist/server/wrangler.json','--local','--persist-to',state,'--ip','127.0.0.1','--port',RESTORE_PORT,'--inspector-port','0'],{stdio:['ignore','pipe','pipe']});const timer=setTimeout(()=>reject(Error('Restored worker startup timeout')),45000);const onData=chunk=>{output+=chunk.toString();if(output.includes('Ready on')){clearTimeout(timer);resolve()}};worker.stdout.on('data',onData);worker.stderr.on('data',onData);worker.on('exit',()=>{clearTimeout(timer);reject(Error('Restored worker exited before readiness'))})});await ready;
 const headers={'oai-authenticated-user-id':actor.user_id,'oai-authenticated-user-email':'owner@example.invalid','x-saha-organisation':actor.active_org_id};const res=await fetch(`http://127.0.0.1:${RESTORE_PORT}/api/workspace`,{headers}),body=await res.json();check(()=>{assert.equal(res.status,200);assert.equal(body.organisation.id,actor.active_org_id);assert.ok(body.people.length>0);assert.ok(body.submissions.length>0)});
 check(()=>{assert.deepEqual(body.people.filter(p=>p.identityReview||p.assignmentHistory?.length).map(p=>({id:p.id,identityReview:p.identityReview,assignmentHistory:p.assignmentHistory})).sort((a,b)=>a.id.localeCompare(b.id)),continuityBefore);assert.deepEqual(body.visits.filter(v=>v.patientCheck).map(v=>({id:v.id,patientCheck:v.patientCheck})).sort((a,b)=>a.id.localeCompare(b.id)),checksBefore)});
 const pilotResponse=await fetch(`http://127.0.0.1:${RESTORE_PORT}/api/pilot`,{headers}),pilotRestored=await pilotResponse.json();check(()=>{assert.equal(pilotResponse.status,200);assert.equal(pilotRestored.pilot.version,pilotBefore.version);assert.deepEqual(pilotRestored.pilot.training,pilotBefore.training);assert.deepEqual(pilotRestored.pilot.decisions,pilotBefore.decisions);assert.equal(pilotRestored.readiness.liveReady,false)});
 const outreachResponse=await fetch(`http://127.0.0.1:${RESTORE_PORT}/api/outreach`,{headers}),outreachRestored=await outreachResponse.json();check(()=>{assert.equal(outreachResponse.status,200);assert.deepEqual(outreachRestored.messages.map(m=>({id:m.id,attempts:m.attempts,recovery:m.recovery})),outreachBefore.messages.map(m=>({id:m.id,attempts:m.attempts,recovery:m.recovery})));assert.equal(outreachRestored.plans.length,outreachBefore.plans.length)});
 const expansionResponse=await fetch(`http://127.0.0.1:${RESTORE_PORT}/api/expansion`,{headers}),expansionRestored=await expansionResponse.json();check(()=>{assert.equal(expansionResponse.status,200);assert.deepEqual(expansionRestored.proposals.map(p=>({id:p.id,evidence:p.evidence,history:p.history})),expansionsBefore.map(p=>({id:p.id,evidence:p.evidence,history:p.history})));assert.equal(expansionRestored.liveExpansion,false)});
 const governanceResponse=await fetch(`http://127.0.0.1:${RESTORE_PORT}/api/governance`,{headers}),governanceRestored=await governanceResponse.json();check(()=>{assert.equal(governanceResponse.status,200);assert.deepEqual(governanceRestored.entries.map(({issues,usable,lifecycle,replacedByRevision,usage,impact,...e})=>e),governanceBefore.entries);assert.deepEqual(governanceRestored.evaluations,governanceBefore.evaluations);assert.deepEqual(governanceRestored.safety.map(({personName,ownerAvailable,...c})=>c),governanceBefore.safety)});
 const ops=await fetch(`http://127.0.0.1:${RESTORE_PORT}/api/operations`,{headers});check(()=>assert.equal(ops.status,200));const stateAfter=new DatabaseSync(target,{readOnly:true});check(()=>assert.equal(stateAfter.prepare('SELECT count(*) AS n FROM command_receipts WHERE org_id=?').get(actor.active_org_id).n,oldReceipt));stateAfter.close();
 const report={passed,release:'11 / v1.3-readiness',source:'isolated synthetic local D1',tables:created.tables,byteCount:created.size,checks:['governance manifests, synthetic evaluation results and safety cases survive restore','consistent SQLite snapshot','encrypted manifest and database','wrong key and ciphertext tamper rejection','fresh destination required','all table counts and digests match','schema digest and integrity checks','append-only history constraints survive','built Worker opens restored database','restored records and receipts accessible','pilot training, decisions and version survive restore','outreach receipt history and expansion evidence survive restore','resolved identities, handover acknowledgements and positive patient checks survive restore','reading restored workspace does not resend actions'],limitations:'No hosted backup, scheduled retention, infrastructure cutover or production RPO/RTO claim. Device-only drafts excluded.',completedAt:new Date().toISOString()};writeFileSync('tests/recovery-result.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}}finally{if(worker){worker.kill('SIGTERM');await new Promise(r=>worker.once('exit',r));}rmSync(temp,{recursive:true,force:true});}
