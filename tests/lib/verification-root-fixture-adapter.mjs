// Root composition of immutable historical fixtures; only module inventory,
// awaited review dispatch and owned result paths change. The module inventory also lists installed-transition-authority,
// which programmes.ts has imported since migration 0032 (a 2026-10-06 integration omission). Assertions stay intact.
import {readFileSync,writeFileSync,unlinkSync,mkdirSync,existsSync,statSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import {countsFromReport} from '../../scripts/test-guard.mjs';
export async function verificationRootFixture(file,{sourceTransform=source=>source}={}){
 const source=sourceTransform(readFileSync(resolve('tests',file),'utf8'));
 if(!/['"]send-gate['"]/.test(source)&&!source.includes('readdirSync'))throw Error('Expected explicit module inventory');
 const current= file==='report-export-contract.mjs'?source.replace('\"saha-operational-report\",\"1.1.0\"','\"saha-operational-report\",\"1.2.0\"'):source;
 const adapted=current.replace(/(\[[^\]]*['"]send-gate['"][^\]]*)(\])/g,'$1, "verification-disputes", "abdm", "abdm-transfer", "access", "action-plan", "adapter-operations", "agent", "agent-minimisation", "aggregate-alert-disclosure", "ai-budget", "alerts", "anaemia", "audit-chain", "availability-types", "capability-lifecycle", "caseload", "consent", "continuity", "core", "delegation", "ehr", "environment", "evaluation", "exceptional", "expansion", "facility-scope", "fact-provenance", "fhir-document", "fhir-validate", "field", "field-registration", "frontline", "governance", "household", "household-constants", "household-visit", "household-visit-constants", "identity", "imported-visits", "indicator-differencing", "indicator-ledger", "indicators", "installed-pack-work", "installed-transition-authority", "media", "merge", "mis", "mis-callback", "operational-disclosure", "operations", "outreach", "pack-installation", "partition", "pilot", "programme-commands", "programme-completion", "programmes", "provider-sandbox", "purpose-scope", "referral-needs", "referral-request", "referral-rules", "reminder-optout", "reason-codes", "retention", "rights", "seed", "send-gate", "service-identity", "shadow", "speech", "store", "task-limits", "team-pack-adoption", "types", "verification-disputes"$2').replace(/^(  )F\.applyFactReview\(/gm,'$1await F.applyFactReview(');
 const results=[],before=new Map();
 const withOutput=adapted.replace(/writeFileSync\((['"])(tests\/[^'"]+\.json)\1/g,(all,quote,original)=>{
  const owned='tests/evidence/verification-programme-root-integration/fixtures/'+file.replace(/\.mjs$/,'')+'/'+original.slice(6);
  mkdirSync(dirname(owned),{recursive:true});results.push(owned);
  before.set(owned,existsSync(owned)?statSync(owned,{bigint:true}).mtimeNs:null);
  return 'writeFileSync('+quote+owned+quote;
 });
 const temporary=resolve('tests','.verification-root-current-'+crypto.randomUUID()+'.mjs');
 writeFileSync(temporary,withOutput);
 try{
  await import(pathToFileURL(temporary).href);
  // A JSON assertion report from this completed invocation supplies the count.
  // Never sum alternate reports of the same original assertion groups.
  for(const file of results){if(!existsSync(file)||statSync(file,{bigint:true}).mtimeNs===before.get(file))continue;const counts=countsFromReport(JSON.parse(readFileSync(file,'utf8')));if(counts){console.log(JSON.stringify({...counts,failed:counts.failed??0,skipped:counts.skipped??0}));break;}}
 }finally{unlinkSync(temporary);}
}
