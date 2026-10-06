import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {identity,client} from './lib/worker.mjs';
import {startMiniflare} from './lib/miniflare.mjs';
const w=await startMiniflare({port:9014,name:'composite-before-gap'});
try{const api=client(w.base),o=identity('composite-before-owner'),s=(await api.get(o,'/api/workspace')).json;
const operand={version:1,expression:{op:'sum',terms:[{measure:'visits-confirmed'},{measure:'referrals-created'}]},fixtures:[{inputs:{'visits-confirmed':0,'referrals-created':0},expected:0},{inputs:{'visits-confirmed':2,'referrals-created':1},expected:3}]};
const response=await api.command(o,{type:'addIndicatorDefinition',id:'owner-contacts',spec:{title:'Owner defined contact sum',unit:'count',numerator:operand,denominator:null,filters:{},exclude:[],exclusionsNote:'Synthetic only',owner:'Synthetic owner',cadence:'Monthly',minimumCohort:5},reason:'Synthetic before-gap demonstration'},s.organisation.id);
assert.equal(response.status,422,response.text);const primitive=await api.call(o,'/api/indicators',{method:'POST',org:s.organisation.id,body:{ids:'visits-confirmed',days:30,group:'none'}});assert.equal(primitive.status,200,primitive.text);
const hashes=Object.fromEntries(['indicators','indicator-registry','indicator-figure-material'].map(x=>[x,createHash('sha256').update(readFileSync('lib/saha/'+x+'.ts')).digest('hex')]));
mkdirSync('tests/evidence/composite-measures/before',{recursive:true});writeFileSync('tests/evidence/composite-measures/before/gap.json',JSON.stringify({diagnosticAssertions:2,acceptedAssertions:0,actualWorker:true,actualD1:true,base:'66d28b83',sourceHashes:hashes,operand,response:{status:response.status,body:response.json},originalPrimitive:primitive.json},null,2)+'\n');console.log('Composite proposal unsupported: actual422; existing primitive200 preserved.');
}finally{await w.stop()}
