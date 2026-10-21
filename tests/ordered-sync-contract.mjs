import assert from 'node:assert/strict';
import {eligibleArrivalP95,OrderedSyncQueue} from '../lib/saha/ordered-sync.ts';

let passed=0;
const check=(value,message)=>{assert.ok(value,message);passed++};
const envelope=(commandId,localSequence,dependencies=[],payload={kind:commandId})=>({commandId,localSequence,dependencies,baseVersion:1,payload});

// Positive ordering: insertion order cannot bypass explicit dependencies or local sequence.
const queue=new OrderedSyncQueue();
queue.enqueue(envelope('referral',3,['encounter']));
queue.enqueue(envelope('person',1));
queue.enqueue(envelope('encounter',2,['person']));
const executed=[];
let clock=0;
const results=await queue.recover(async()=>true,async item=>executed.push(item.commandId),()=>new Date(++clock*1000).toISOString());
check(executed.join(',')==='person,encounter,referral','Person, encounter and referral execute in valid dependency order');
check(results.every(result=>result.outcome==='accepted'),'Every eligible item returns its own accepted result');

// Stable identity and recovery: accepted items survive export/restore and are never replayed.
const restored=new OrderedSyncQueue(queue.export());
let replayed=0;
await restored.recover(async()=>true,async()=>{replayed++});
check(replayed===0,'Accepted stable command IDs are not replayed after reconnect');
assert.throws(()=>restored.enqueue(envelope('person',1,[],{changed:true})),/different content/);passed++;

// Connection loss leaves an explicit unresolved item while dependants remain pending.
const interrupted=new OrderedSyncQueue([ {envelope:envelope('person-2',1)}, {envelope:envelope('visit-2',2,['person-2'])} ]);
let attempts=0;
let interruptedResults=await interrupted.recover(async()=>true,async item=>{attempts++;if(item.commandId==='person-2')throw new Error('Synthetic connection loss')});
check(interruptedResults[0].outcome==='unresolved'&&interruptedResults[1].outcome==='dependency-pending','Connection loss creates unresolved and dependency-pending results without an orphan');
interruptedResults=await interrupted.recover(async()=>true,async()=>{attempts++});
check(interruptedResults.every(result=>result.outcome==='accepted')&&attempts===3,'Reconnect retries unresolved work once and then releases its dependant');

// Authority is checked per item at reconnect and refusals are not counted as success.
const refused=new OrderedSyncQueue([ {envelope:envelope('person-3',1)}, {envelope:envelope('referral-3',2,['person-3'])} ]);
const refusedResults=await refused.recover(async item=>item.commandId!=='referral-3',async()=>{});
check(refusedResults[0].outcome==='accepted'&&refusedResults[1].outcome==='rejected','Permission rejection is reported separately from accepted work');

// Missing and cyclic dependencies remain explicit and cause no side effects.
const missing=new OrderedSyncQueue([ {envelope:envelope('orphan',1,['absent'])} ]);let sideEffects=0;
check((await missing.recover(async()=>true,async()=>{sideEffects++}))[0].outcome==='unresolved'&&sideEffects===0,'Missing dependency cannot create an orphan side effect');
const cycle=new OrderedSyncQueue([ {envelope:envelope('a',1,['b'])}, {envelope:envelope('b',2,['a'])} ]);
check((await cycle.recover(async()=>true,async()=>{sideEffects++})).every(result=>result.outcome==='dependency-pending')&&sideEffects===0,'Dependency cycle remains pending without writes');

// Concurrent reconnect signals share one drain rather than execute commands twice.
const raced=new OrderedSyncQueue([ {envelope:envelope('race',1)} ]);let raceExecutions=0;
await Promise.all([raced.recover(async()=>true,async()=>{raceExecutions++;await new Promise(resolve=>setTimeout(resolve,5))}),raced.recover(async()=>true,async()=>{raceExecutions++})]);
check(raceExecutions===1,'Concurrent recovery calls execute a stable command once');

// Queue contract validation and the source 200-record p95 measurement.
assert.throws(()=>new OrderedSyncQueue([{envelope:envelope('bad',0)}]),/positive integer/);passed++;
assert.throws(()=>new OrderedSyncQueue([{envelope:envelope('self',1,['self'])}]),/cannot include/);passed++;
const arrivals=Array.from({length:200},(_,index)=>1000+(index+1)*1000);
check(eligibleArrivalP95(1000,arrivals)===190000,'200-record fixture reports the 95th percentile eligible arrival');

console.log(JSON.stringify({passed,failed:0,scope:'Ordered structured sync queue: stable IDs, dependency order, versions/sequences, interruption recovery, per-item authority/refusal/results, missing/cyclic dependencies, concurrent drain and 200-record p95 measurement. Synthetic local contract; not physical-device, reference-network or formal acceptance.'}));
