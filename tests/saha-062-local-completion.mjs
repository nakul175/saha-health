import assert from 'node:assert/strict';
import ts from 'typescript';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.saha-062-'));
let passed=0;
const check=(name,fn)=>{fn();passed++;return name};
try {
  for (const file of ['provider-sandbox-contract']) {
    const js=ts.transpileModule(readFileSync(`lib/saha/${file}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'");
    writeFileSync(join(dir,file+'.js'),js);
  }
  const {providerSelfServiceContract}=await import(pathToFileURL(join(dir,'provider-sandbox-contract.js')));
  const sb={providerId:'provider-a',providerName:'Provider A',declaredAt:'2026-10-16T00:00:00.000Z',declaredBy:'owner',reason:'Approved synthetic testing only.'};
  const contract=providerSelfServiceContract(sb);
  check('contract is explicitly synthetic and logically isolated',()=>assert.deepEqual([contract.environment,contract.isolation],['synthetic-provider-sandbox','organisation-bound-logical-isolation']));
  check('contract is pinned to the sandbox provider',()=>assert.equal(contract.capabilityProviderId,'provider-a'));
  check('contract permits only the required provider self-service outcomes',()=>assert.deepEqual(contract.allowed,['maintain-own-documentation','record-test-credential-reference','propose-own-capability-version','run-approved-synthetic-evaluation']));
  check('contract denies patient, other-provider, self-review and activation paths',()=>assert.deepEqual(contract.prohibited,['read-patient-records','read-other-provider-proposals','review-own-proposal','activate-sandbox-capability','publish-directly-to-production']));
  check('contract names every production governance step',()=>assert.deepEqual(contract.productionActivationPath,['owner-imports-draft','production-synthetic-evaluation','independent-clinical-review','owner-activation']));
  check('contract does not expose declaration or documentation data',()=>assert.equal(JSON.stringify(contract).includes('Approved synthetic testing'),false));
  const implementation=readFileSync('lib/saha/provider-sandbox.ts','utf8');
  check('server enforcement retains the provider command allowlist',()=>assert.match(implementation,/PROVIDER_COMMANDS=\['createGovernance','prepareEvaluation','runEvaluationCase','cancelEvaluation','saveProviderDocs','switchOrganisation'\]/));
  check('server enforcement refuses sandbox activation',()=>assert.match(implementation,/cannot activate or suspend a capability/));
  check('server enforcement retains optimistic documentation versioning',()=>assert.match(implementation,/Provider documentation changed\. Refresh before saving/));
  check('credential values remain excluded from imported evidence',()=>assert.match(implementation,/credential references stay in the sandbox|credentialReference/));
  const ui=readFileSync('app/provider-sandbox-panel.tsx','utf8');
  check('provider UI renders the server contract',()=>assert.match(ui,/Provider self-service contract/));
  check('provider UI states isolation is logical',()=>assert.match(ui,/does not represent a separate deployment or database/));
  console.log(JSON.stringify({suite:'saha-062-local-completion',passed,completedAt:new Date().toISOString()}));
} finally { rmSync(dir,{recursive:true,force:true}); }
