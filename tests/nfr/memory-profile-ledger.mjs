// Analyze only the synthetic profiler's isolated D1 state. No patient rows/values are exported.
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const evidence='tests/evidence/memory-profile',profile=JSON.parse(readFileSync(evidence+'/result.json','utf8'));assert.equal(profile.completed,true);
const results=[];
for(const name of ['profile-reference','profile-instrumented']){
 const folder='.wrangler/'+name+'-state/v3/d1',files=readdirSync(folder,{recursive:true}).filter(f=>f.endsWith('.sqlite')&&!f.endsWith('metadata.sqlite'));assert.equal(files.length,1);const db=new DatabaseSync(join(folder,files[0]),{readOnly:true});
 const audit=db.prepare("SELECT count(*) count, sum(length(CAST(id||actor_id||actor_name||role||action||subject||detail||at||coalesce(hash,'')||coalesce(prev_hash,'') AS BLOB))) logicalTextBytes FROM audit_events WHERE action='viewWorkspace'").get();
 assert.equal(audit.count,1+100+profile.loadsPerRound*profile.rounds);results.push({name,patients:db.prepare('SELECT count(*) n FROM patients').get().n,visits:db.prepare('SELECT count(*) n FROM visits').get().n,workspaceAccessAuditRows:audit.count,workspaceAccessAuditLogicalTextBytes:audit.logicalTextBytes,logicalTextBytesPerLoad:audit.logicalTextBytes/audit.count,allAuditRows:db.prepare('SELECT count(*) n FROM audit_events').get().n});db.close();
}
const summary={date:'2026-10-05',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,platform:process.platform,architecture:process.arch,installedRuntimePackages:readdirSync('node_modules/.pnpm').filter(n=>/^(workerd|miniflare)@/.test(n)),results,limits:['Logical audit text byte count omits numeric fields, indices, SQLite page overhead and WAL amplification. Database growth in result.json includes all state/WAL files.','Read-only synthetic ledger counts, not representative per-patient or connector scale qualification.']};writeFileSync(evidence+'/ledger-analysis.json',JSON.stringify(summary,null,2)+'\n');console.log(JSON.stringify(summary));
