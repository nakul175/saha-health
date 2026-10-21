import assert from 'node:assert/strict';
import ts from 'typescript';
import {mkdtempSync,readFileSync,readdirSync,rmSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const dir=mkdtempSync(join(process.cwd(),'.saha-021-provenance-')),cases=[];
const check=(name,fn)=>{fn();cases.push(name)};
try{
 for(const file of readdirSync('lib/saha').filter(x=>x.endsWith('.ts')))writeFileSync(join(dir,file.replace(/\.ts$/,'.js')),ts.transpileModule(readFileSync(join('lib/saha',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 const D=await import(pathToFileURL(join(dir,'fhir-document.js')).href),C=await import(pathToFileURL(join(dir,'core.js')).href);
 const person={id:'p_external',name:'Synthetic Person',age:30,sex:'Female',village:'Synthetic village',version:1,consentVersion:1,exchangeConsent:true,status:'active'};
 const visit={id:'v_local',personId:person.id,version:4,recordVersion:2,state:'confirmed',createdAt:'2026-10-16T01:00:00Z',confirmedAt:'2026-10-16T01:05:00Z',facts:{date:'2026-10-16T01:00',systolic:'120',diastolic:'80',weight:'60',temperature:'37',weeks:'',coughDays:'',notes:'Synthetic',source:'measured',provenance:{weight:{source:'reported',at:'2026-10-15T10:30'}}},factAuthors:{weight:{userId:'asha-1',name:'Synthetic ASHA',role:'asha',at:'2026-10-16T01:00:00Z'},temperature:{userId:'asha-1',name:'Synthetic ASHA',role:'asha',at:'2026-10-16T01:00:00Z'}},factReviews:[{id:'review-1',measure:'weight',state:'verified',by:'clinician-1',byName:'Synthetic clinician',at:'2026-10-16T01:04:00Z'}],aiResults:[]};
 const local=D.fhirDocument(person,visit,'Synthetic organisation','Synthetic confirmer','doc-local',person.id);
 const localSummary=D.inspectDocument(local,person.id),weight=localSummary.observations.find(x=>x.code==='29463-7');
 check('Local export carries an explicit source system',()=>assert.equal(weight.provenance.sourceSystem,D.FHIR_SOURCE_SYSTEM));
 check('Local export carries a stable source identifier',()=>assert.equal(weight.provenance.sourceIdentifier,'v_local:weight'));
 check('Local export carries the source visit version and transformation version',()=>{assert.equal(weight.provenance.transformationVersion,D.FHIR_TRANSFORMATION_VERSION);assert.equal(local.entry.find(x=>x.fullUrl&&x.resource?.identifier?.[0]?.value==='v_local:weight').resource.meta.versionId,'4')});
 check('Local export keeps effective and receipt times distinct',()=>{assert.equal(weight.provenance.effectiveTime,'2026-10-15T10:30:00.000Z');assert.equal(weight.provenance.receiptTime,local.timestamp)});
 check('Local export keeps author and verification evidence',()=>{assert.match(weight.provenance.authorOrDevice,/Synthetic ASHA/);assert.match(weight.provenance.verificationState,/verified/)});
 const external=structuredClone(local);external.id='external-bundle';external.identifier.value='external-lab-document';external.meta.source='https://synthetic-lab.example/fhir';external.meta.versionId='document-v7';external.meta.tag=external.meta.tag.filter(x=>x.system!==D.FHIR_TRANSFORMATION_SYSTEM);external.meta.tag.push({system:D.FHIR_TRANSFORMATION_SYSTEM,code:'synthetic-lab-map-v3'});external.timestamp='2026-10-16T02:00:00.000Z';
 const extObs=external.entry.find(x=>x.resource?.resourceType==='Observation'&&x.resource.code.coding[0].code==='29463-7');extObs.resource.meta.source='https://synthetic-lab.example/fhir';extObs.resource.meta.versionId='result-v2';extObs.resource.meta.tag=[{system:D.FHIR_TRANSFORMATION_SYSTEM,code:'synthetic-lab-result-map-v2'}];extObs.resource.identifier=[{system:'https://synthetic-lab.example/results',value:'LAB-RESULT-42'}];extObs.resource.status='amended';
 const externalSummary=D.inspectDocument(external,person.id),lab=externalSummary.observations.find(x=>x.code==='29463-7');
 check('Imported result remains visibly external',()=>assert.equal(lab.provenance.sourceSystem,'https://synthetic-lab.example/fhir'));
 check('Imported result retains source identifier and original status',()=>assert.deepEqual([lab.provenance.sourceIdentifier,lab.provenance.originalStatus],['LAB-RESULT-42','amended']));
 check('Imported result retains its element transformation version',()=>assert.equal(lab.provenance.transformationVersion,'synthetic-lab-result-map-v2'));
 check('Imported and worker-recorded facts cannot collapse to the same provenance',()=>assert.notDeepEqual(lab.provenance,weight.provenance));
 const broken=structuredClone(external),prov=broken.entry.find(x=>x.resource?.resourceType==='Provenance');prov.resource.target=[{reference:'urn:uuid:not-present'}];
 check('Unresolved provenance target is refused',()=>assert.throws(()=>D.inspectDocument(broken,person.id),/reference is not resolved/));
 const missingAgent=structuredClone(external);missingAgent.entry.find(x=>x.resource?.resourceType==='Provenance').resource.agent=[];
 check('Unaccountable provenance is refused',()=>assert.throws(()=>D.inspectDocument(missingAgent,person.id),/accountable agent/));
 const controls=structuredClone(external);controls.entry.find(x=>x.resource?.resourceType==='Observation').resource.meta.source='bad\nsource';
 check('Control characters in source provenance are refused',()=>assert.throws(()=>D.inspectDocument(controls,person.id),/Invalid source system provenance/));
 check('Value plus missing/refusal state remains invalid input',()=>assert.throws(()=>C.checkFacts({...visit.facts,provenance:{weight:{source:'declined'}}},Date.parse('2026-10-16T03:00:00Z')),/recorded value must be measured or reported/));
 check('Inspection is read only under repeated version comparison',()=>{const before=JSON.stringify(external);D.inspectDocument(external,person.id);D.inspectDocument(external,person.id);assert.equal(JSON.stringify(external),before)});
 check('Presentation names every required lineage field',()=>{const ui=readFileSync('app/ehr-panel.tsx','utf8');for(const term of ['sourceSystem','sourceIdentifier','authorOrDevice','originalStatus','verificationState','transformationVersion','receiptTime'])assert.ok(ui.includes(term),term)});
 const report={story:'SAHA-021',passed:cases.length,failed:0,skipped:0,cases,completedAt:new Date().toISOString(),limits:['Synthetic local FHIR document import/export/display contract only; no partner, ABDM, clinical, formal acceptance, CI, merge or deployment claim.']};writeFileSync('tests/saha-021-exchange-provenance-contract-result.json',JSON.stringify(report,null,2)+'\n');console.log(`${cases.length} SAHA-021 exchange provenance checks passed`);
}finally{rmSync(dir,{recursive:true,force:true})}
