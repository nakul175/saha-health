import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {startMiniflare} from './lib/miniflare.mjs';
import {identity,client} from './lib/worker.mjs';
const evidence='tests/evidence/mapping-remaining-audit',w=await startMiniflare({port:8987,name:'mapping-remaining-audit',bindings:{SAHA_ENVIRONMENT:'synthetic'}});
let passed=0;
try{
 const api=client(w.base),owner=identity('mapping-remaining-owner');let snapshot=(await api.get(owner,'/api/workspace')).json;const org=snapshot.organisation.id;
 const observations=[];
 async function post(body,status=200){const r=await api.call(owner,'/api/commands',{method:'POST',org,body,headers:{'Idempotency-Key':crypto.randomUUID()}});assert.equal(r.status,status,r.text);if(r.json.snapshot)snapshot=r.json.snapshot;passed++;return r.json;}
 await post({type:'registerIntegration',name:'Synthetic remaining mapping audit',kind:'mis',endpoint:'https://programme.example/v1/visits',credentialBinding:'SAHA_MIS_TEST',description:'Contract audit only; external transport disabled'});
 const id=snapshot.integrations.find(i=>i.name==='Synthetic remaining mapping audit').id,current=()=>snapshot.integrations.find(i=>i.id===id),base=()=>({integrationId:id,version:current().version,lifecycleVersion:current().mis?.lifecycle?.version??0});
 await post({type:'configureMis',integrationId:id,version:current().version,mapping:[{source:'weight',target:'weight_kg',required:true}],programmes:['General care'],corrections:true});
 const draft=()=>({type:'draftMisMapping',...base(),mapping:[{source:'personId',target:'patient_reference',required:true}],programmes:['General care'],corrections:true,source:{reference:'synthetic-contract-audit',version:'v1'},terminology:[],effectiveAt:'2020-01-01T00:00:00.000Z'});
 for(const [clause,change] of [
  ['declared transformation',{mapping:[{source:'weight',target:'weight_lb',required:true,transformation:'kg-to-lb'}]}],
  ['destination unit semantics',{mapping:[{source:'weight',target:'weight_lb',required:true,unit:'lb'}]}],
  ['explicit null semantics',{mapping:[{source:'weight',target:'weight_kg',required:false,nullSemantics:'omit'}]}],
  ['owner-approved conformance fixtures',{fixtures:[{source:{weight:'55'},expected:{weight_kg:'55'}}]}],
  ['explicit unmapped terminology state',{terminology:[{target:'patient_reference',system:'partner-local',code:'synthetic',status:'unmapped'}]}]
 ]){const r=await post({...draft(),...change},422);observations.push({clause,status:422,error:r.error,supported:false});}
 const d=await post(draft()),impact=await post({type:'impactMisMapping',...base(),revisionId:d.result.revisionId});
 await post({type:'reviewMisMapping',...base(),revisionId:d.result.revisionId,impactHash:impact.result.impactHash});
 await post({type:'applyMisMapping',...base(),revisionId:d.result.revisionId,impactHash:impact.result.impactHash});
 assert.equal(current().status,'suspended');assert.equal(current().mis.mapping.some(m=>m.target==='weight_kg'),false);
 observations.push({clause:'destination mandatory field conformance',publishedWithoutPriorRequiredWeight:true,connectorSuspended:true,activationAttempted:false,externalSourceContractPresent:false,meaning:'Publication has no independently declared destination mandatory-field fixture; suspension and disabled transport still guard live activation.'});
 mkdirSync(evidence,{recursive:true});writeFileSync(evidence+'/http.json',JSON.stringify({date:'2026-10-05',sourceBase:'e80a6242ba208aec32ed2eca475f9da82ad25cdb',reviewFix:'10aab48c3a695400827cf602b2875b71419c7560',passed,failed:0,actualWorker:true,actualD1:true,externalProviderCalls:0,formalAcceptancePromoted:false,observations},null,2)+'\n');console.log({passed,failed:0});
}finally{await w.stop();}
