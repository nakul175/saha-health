import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readFileSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.data-flow-panel-'));
let passed=0;
try {
  const source=readFileSync('lib/saha/data-flow-authority-view.ts','utf8');
  writeFileSync(join(dir,'view.js'),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
  const view=await import(pathToFileURL(join(dir,'view.js')));
  assert.equal(view.defaultDataFlowPurpose('provider'),'ai-assistance');passed++;
  assert.equal(view.defaultDataFlowPurpose('connector'),'programme-delivery');passed++;
  const records=[
    {id:'programme',targetId:'mis-1',accessPurpose:'programme-delivery',state:'approved'},
    {id:'reporting',targetId:'mis-1',accessPurpose:'reporting',state:'approved'},
  ];
  assert.equal(view.selectedDataFlowAuthority(records,'mis-1','programme-delivery').id,'programme');passed++;
  assert.equal(view.selectedDataFlowAuthority(records,'mis-1','reporting').id,'reporting');passed++;
  assert.equal(view.selectedDataFlowAuthority(records,'mis-1','ai-assistance'),undefined);passed++;
  const panel=readFileSync('app/data-flow-authority-panel.tsx','utf8');
  assert.match(panel,/selectedDataFlowAuthority\(records,targetId,accessPurpose\)/);assert.doesNotMatch(panel,/useEffect\([^;]+setAccessPurpose/s);passed++;
  const governance=readFileSync('app/governance-panel.tsx','utf8');
  assert.match(governance,/IndependentDataFlowAuthorityPanel/);assert.match(governance,/provider\.mode!=='local'/);assert.match(governance,/targetId=\{provider\.id\}/);passed++;
  console.log(JSON.stringify({suite:'data-flow-authority-panel-contract',passed}));
} finally { rmSync(dir,{recursive:true,force:true}); }
