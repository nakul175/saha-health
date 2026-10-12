import assert from 'node:assert/strict';
import ts from 'typescript';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = mkdtempSync('.today-guidance-contract-'), checks = [];
const check = (label, test) => { test(); checks.push(label); };
try {
  for (const [source, target] of [['app/guided-instructions.ts','guided-instructions.js'],['app/today/today-instructions.ts','today-instructions.js']])
    writeFileSync(join(dir,target), ts.transpileModule(readFileSync(source,'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("'../guided-instructions'","'./guided-instructions.js'"));
  const { TODAY_INSTRUCTIONS, todayInstructionPlayer } = await import(pathToFileURL(join(process.cwd(),dir,'today-instructions.js')));
  const en={lang:'en-IN',localService:true}, hi={lang:'hi-IN',localService:true}, remote={lang:'hi-IN',localService:false};
  let voices=[en,hi,remote], sent=[], cancelled=0, states=[];
  const engine={getVoices:()=>voices,speak:u=>sent.push(u),cancel:()=>cancelled++};
  const player=todayInstructionPlayer(engine,text=>({text}),x=>states.push(x));
  check('No automatic playback',()=>assert.equal(sent.length,0));
  check('Explicit English local playback',()=>assert.equal(player.play('en'),true));
  check('Only fixed public English navigation text',()=>assert.equal(sent[0].text,TODAY_INSTRUCTIONS.en));
  check('Actual selected local English voice',()=>assert.equal(sent[0].voice,en));
  const late=sent[0].onend;
  check('Explicit Stop cancels active playback',()=>{player.stop();assert.equal(cancelled,1);assert.equal(states.at(-1),false);});
  check('Canceled late completion cannot restore playing',()=>{late();assert.equal(states.at(-1),false);});
  check('Hindi selection reads only fixed Hindi navigation',()=>{assert.equal(player.play('hi'),true);assert.equal(sent.at(-1).text,TODAY_INSTRUCTIONS.hi);assert.equal(sent.at(-1).voice,hi);});
  check('Remote Hindi voice never substituted',()=>{voices=[remote];assert.equal(player.play('hi'),false);assert.equal(sent.length,2);});
  check('Other local language does not qualify Hindi',()=>{voices=[en];assert.equal(player.play('hi'),false);});
  check('Unknown local-service marker refuses',()=>{voices=[{lang:'hi-IN',localService:'true'}];assert.equal(player.play('hi'),false);});
  check('No voice is unavailable, not provider fallback',()=>{voices=[];assert.equal(player.play('en'),false);});
  check('Throwing native enumeration refuses',()=>{engine.getVoices=()=>{throw Error('unavailable');};assert.equal(player.play('en'),false);});
  check('Throwing speech start clears playing',()=>{engine.getVoices=()=>[en];engine.speak=()=>{throw Error('unavailable');};assert.equal(player.play('en'),false);assert.equal(states.at(-1),false);});
  check('Public text mentions unsaved opening and assigned-list limit',()=>{assert.match(TODAY_INSTRUCTIONS.en,/not a dated daily schedule/);assert.match(TODAY_INSTRUCTIONS.en,/saves nothing/);});
  const component=readFileSync('app/today/today-guidance.tsx','utf8');
  check('No recognizer, provider, record props, writer or transcript',()=>{for(const word of ['SpeechRecognition','fetch(','patient.name','record.name','transcript','cloudAllowed'])assert.ok(!component.includes(word));});
  check('Context teardown is commit-phase and privacy listeners exist',()=>{assert.match(component,/useLayoutEffect/);for(const name of ['visibilitychange','pagehide','offline'])assert.ok(component.includes(name));});
  check('Today mounts guidance only in authorised list or record states',()=>assert.match(readFileSync('app/today/today.tsx','utf8'),/view.kind === 'list' \|\| view.kind === 'record'/));
  check('Original readonly Today keeps zero form fields',()=>{assert.ok(!/<(?:input|textarea|select)\b/i.test(component));});
  check('Optional collapsed disclosure does not autoplay and closing stops',()=>{assert.ok(component.includes('<details onToggle='));assert.ok(!/<details[^>]*\bopen(?:[=>\s])/.test(component));assert.ok(component.includes('!event.currentTarget.open'));});
  check('Throwing native utterance constructor returns unavailable with no speech or restored playback',()=>{
    let spoken=0;const states=[];
    const failed=todayInstructionPlayer({getVoices:()=>[en],speak:()=>spoken++,cancel:()=>{}},()=>{throw Error('Native utterance constructor unavailable');},playing=>states.push(playing));
    assert.equal(failed.play('en'),false);assert.equal(spoken,0);assert.equal(states.at(-1),false);
  });
  const result={passed:checks.length,failed:0,skipped:0,checks,completedAt:new Date().toISOString(),limits:'Pure original-controller synthetic checks; no physical synthesis/recognition/field-usability/formal/hosting acceptance.'};
  mkdirSync('tests/reports',{recursive:true});writeFileSync('tests/reports/today-guidance-contract-result.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
} finally { rmSync(dir,{recursive:true,force:true}); }
