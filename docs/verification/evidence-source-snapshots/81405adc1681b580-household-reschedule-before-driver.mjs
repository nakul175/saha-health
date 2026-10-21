// Slice 10f contract: household visit slots (planning only, per-member scope) and cross-pack referral consolidation.
import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(process.cwd(), '.household-visit-contract-'));
let passed = 0;
const check = fn => { fn(); passed++; };
const status = (fn, code, msg) => { try { fn(); } catch (e) { assert.equal(e.status, code, `${msg ?? ''} ${e.message}`); return e; } assert.fail(`expected ${code}${msg ? ': ' + msg : ''}`); };
try {
  for (const f of ['abdm', 'abdm-transfer', 'access', 'action-plan', 'adapter-operations', 'agent', 'agent-minimisation', 'ai-budget', 'alerts', 'anaemia', 'audit-chain', 'capability-lifecycle', 'caseload', 'consent', 'continuity', 'core', 'data-exit', 'delegation', 'ehr', 'environment', 'evaluation', 'exceptional', 'expansion', 'facility-scope', 'fact-provenance', 'fhir-document', 'fhir-validate', 'field', 'field-registration', 'governance', 'household', 'household-constants', 'household-visit', 'household-visit-constants', 'identity', 'imported-visits', 'media', 'merge', 'mis', 'operations', 'outreach', 'pack-installation', 'partition', 'pilot', 'programme-commands', 'programmes', 'provider-sandbox', 'purpose-scope', 'referral-consolidation', 'referral-needs', 'referral-request', 'referral-rules', 'retention', 'rights', 'seed', 'send-gate', 'service-identity', 'shadow', 'store', 'task-limits', 'types'])
    writeFileSync(join(dir, f + '.js'), ts.transpileModule(readFileSync(`lib/saha/${f}.ts`, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText.replace(/from '(\.\/[^']+)'/g, "from '$1.js'"));
  const baseline=(await import('node:child_process')).execFileSync('git',['show','fb585412:lib/saha/household-visit.ts'],{encoding:'utf8'});
  writeFileSync(join(dir,'household-visit.js'),ts.transpileModule(baseline,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
  const hv=await import(pathToFileURL(join(dir,'household-visit.js')));
  const command={type:'householdVisitReschedule',householdId:'synthetic-household',version:1,visitId:'synthetic-slot',date:'2026-10-10',window:'morning',personVersions:[{personId:'synthetic-person',version:1}]};
  assert.equal(hv.householdVisitSchema.safeParse(command).success,false);passed++;
  assert.equal(hv.applyHouseholdVisit({},command,{},{}),null);passed++;
  (await import('node:fs')).mkdirSync('tests/evidence/household-reschedule',{recursive:true});
  writeFileSync('tests/evidence/household-reschedule/before.json',JSON.stringify({baseline:'fb585412',passed,missingBehavior:'No accepted atomic reschedule command; existing cancel/schedule requires two separate mutations.',historicalDiagnostic:true,realProvidersCalled:false},null,2)+'\n');console.log(JSON.stringify({passed}));
}finally{rmSync(dir,{recursive:true,force:true})}
