import { DatabaseSync } from 'node:sqlite';
import { globSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { seedWorkspace } from '../lib/saha/seed.ts';
const paths=globSync('.wrangler/test-state/v3/d1/**/*.sqlite').filter(p=>!p.endsWith('/metadata.sqlite'));
if(paths.length!==1)throw Error('Expected one local test database; apply migrations first.');
const database=new DatabaseSync(paths[0]);database.exec('PRAGMA busy_timeout=5000');
export const sql=database;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function fixture(){const actor=`legacy-${randomUUID()}`,now='2026-09-20T08:00:00.000Z',w=seedWorkspace(now);
 for(const p of w.people){delete p.version;delete p.teamId;delete p.assignedTo;}
 const facts={date:'2026-09-20T08:00',systolic:'118',diastolic:'76',weight:'56',temperature:'',weeks:'24',coughDays:'',notes:'Synthetic legacy migration fixture',source:'measured'};
 w.visits=[{id:'legacy-confirmed',personId:'p_meena',version:3,state:'confirmed',facts,createdAt:now,confirmedAt:now,plan:{id:'legacy-plan',state:'approved',visitVersion:3,consentVersion:1,connectorVersions:{mis_maternal:1},recipients:['mis_maternal'],payloadHash:'legacy-payload',purpose:'Legacy approval',createdAt:now,approvedAt:now,approvedBy:'Legacy owner',expiresAt:'2030-01-01T00:00:00.000Z'},aiResults:[{id:'legacy-ai',providerId:'ai_summary',providerName:'Visit summariser',mode:'demo',status:'succeeded',text:'Synthetic legacy output',createdAt:now,inputHash:'legacy-hash',reviewed:true}]}];
 w.submissions=[{id:'legacy-submission',personId:'p_meena',visitId:'legacy-confirmed',connectorId:'mis_maternal',connectorName:'Maternal & child register',state:'accepted',mode:'demo',payloadHash:'legacy-payload',receipt:'SIM-LEGACY',attempts:1,message:'Previously accepted',createdAt:now,updatedAt:now}];
 w.referrals=[{id:'legacy-referral',personId:'p_meena',visitId:'legacy-confirmed',facility:'Synthetic PHC',reason:'Legacy test handover',state:'draft',createdAt:now}];
 w.audit=[{id:'legacy-audit',at:now,actor:'Legacy owner',role:'asha',action:'confirmVisit',subject:'legacy-confirmed',detail:'Legacy record confirmed.'}];
 w.revision=8;w.receipts={'legacy-command-key':{hash:'legacy-command-hash',result:{visitId:'legacy-confirmed'}}};
 const source=JSON.stringify(w);database.prepare('INSERT INTO workspaces (owner_id,revision,state,updated_at) VALUES (?,8,?,?)').run(actor,source,now);
 return {actor,source,hash:hash(source),visit:w.visits[0]};
}
export function verifyMigration(f,orgId){
 const original=database.prepare('SELECT * FROM workspaces WHERE owner_id=?').get(f.actor);assert.equal(original.state,f.source);assert.equal(original.revision,8);
 const migrated=database.prepare('SELECT * FROM legacy_migrations WHERE owner_id=?').get(f.actor);assert.equal(migrated.org_id,orgId);assert.equal(migrated.source_hash,f.hash);assert.equal(migrated.source_revision,8);
 const expected={patients:6,visits:1,plans:1,ai_results:1,submissions:1,referrals:1,record_revisions:7,audit_events:2,command_receipts:1};for(const [table,count]of Object.entries(expected))assert.equal(database.prepare(`SELECT count(*) AS n FROM ${table} WHERE org_id=?`).get(orgId).n,count,table);
 assert.throws(()=>database.prepare('UPDATE record_revisions SET reason=? WHERE org_id=?').run('Tamper attempt',orgId),/append-only/);
 assert.throws(()=>database.prepare('DELETE FROM audit_events WHERE org_id=?').run(orgId),/append-only/);
 return 15;
}
