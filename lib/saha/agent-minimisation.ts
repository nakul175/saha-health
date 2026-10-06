import { fail } from './core';
import { currentIdentifiers } from './types';
import type { OrgState } from './types';
// Slice R42: comprehensive minimisation of AI provider payloads (BR-AG-02, BR-AI-08, BR-INT-09).
//
// The mapped allowlist for the AI provider payloads is fixed here; nothing outside it may reach a provider.
// `checkAgentSource` runs before a request is prepared (prepareAgent) and again inside the external-execution
// checkpoint (executeAgent), refusing rather than sending when the source carries patient data that stripping
// cannot remove. `minimiseAgentPayload` walks a built provider payload, strips any field outside the allowlist
// and refuses when a field's value still leaks a patient identifier. This is an additive guard: the existing
// allowlists (FIELDS, OUTPUT_SCHEMA, INSTRUCTIONS and the MIS/EHR field mappings) are unchanged.

// The keys that may appear in an AI provider request envelope. `schema` (OpenAI) and `outputSchema` (HTTP)
// hold the static OUTPUT_SCHEMA constant and `instructions` the static INSTRUCTIONS constant; those values are
// pre-approved and carried by reference, not walked, so they can never introduce an unknown key.
export const PAYLOAD_KEYS: Readonly<Record<'openai' | 'http', ReadonlySet<string>>> = {
  openai: new Set(['model', 'store', 'max_output_tokens', 'instructions', 'input', 'text', 'format', 'type', 'name', 'strict', 'schema']),
  http: new Set(['contract', 'agentVersion', 'model', 'task', 'source', 'outputSchema', 'limits', 'maxOutputTokens', 'maxCalls', 'instructions']),
};
export type MinimisationStage = 'prepare' | 'before-send' | 'checkpoint';
export type MinimisationCheck = { at: string; stage: MinimisationStage; passed: boolean; fields: number; stripped: string[]; problems: string[] };

// Every patient name, village, ABHA number (grouped and plain), ABHA address and current external identifier in
// the organisation, lowercased and trimmed. Anything in this set must never reach an AI provider. Internal record
// and visit ids are UUIDs and are left out: they are not meaningful to a provider and would only risk false
// refusals on free text, whereas names, villages, ABHA and crosswalk identifiers are the fields a provider must
// not receive.
export function collectSensitive(s: OrgState): Set<string> {
  const set = new Set<string>();
  const add = (v: unknown) => { if (typeof v === 'string') { const t = v.trim().toLowerCase(); if (t) set.add(t); } };
  for (const p of s.workspace.people ?? []) {
    if (p.name.trim().length >= 3) add(p.name);
    if (p.village.trim().length >= 3) add(p.village);
    if (p.abha?.number) { add(p.abha.number); add(p.abha.number.replace(/-/g, '')); }
    if (p.abha?.address) add(p.abha.address);
    for (const id of currentIdentifiers(p)) add(id.value);
  }
  return set;
}

// Canonical comparison handles known Unicode presentation variants, not guessed encodings.
export function sensitiveText(value:string){return value.normalize('NFKC').replace(/[\u200B-\u200D\u2060\uFEFF]/g,'').replace(/\s+/g,' ').trim().toLowerCase();}
export function carriesSensitive(value:string,sensitive:Set<string>){const text=sensitiveText(value);return [...sensitive].some(v=>{const known=sensitiveText(v);if(!known)return false;if(/^\d+$/.test(known)&&known.length<8)return new RegExp('(?:abha|rch|nikshay|identifier|record id)[: #\\s-]+'+known+'(?![0-9])').test(text);return text.includes(known);});}
export function checkAgentSource(source:string,s:OrgState):void{if(carriesSensitive(source,collectSensitive(s)))fail(422,'The external AI source still carries patient data that cannot be removed. Remove it from the note or record the measurement manually.');}
const PATH_KEYS:Record<'openai'|'http',Record<string,ReadonlySet<string>>>={openai:{'':new Set(['model','store','max_output_tokens','instructions','input','text']),text:new Set(['format']),'text.format':new Set(['type','name','strict','schema'])},http:{'':new Set(['contract','agentVersion','model','task','source','outputSchema','limits','instructions']),limits:new Set(['maxOutputTokens','maxCalls'])}};
export function minimiseAgentPayload(payload:unknown,mode:'openai'|'http',sensitive:Set<string>,stage:MinimisationStage,at:string,trustedStatic?:{instructions:string;schema:unknown}):{payload:unknown;check:MinimisationCheck}{
 const stripped:string[]=[],problems:string[]=[];let fields=0;
 const scan=(x:unknown,path:string,depth=0)=>{if(depth>24){problems.push('Envelope nesting exceeds the contract.');return;}if(typeof x==='string'&&carriesSensitive(x,sensitive))problems.push(path+' carries sensitive data.');else if(Array.isArray(x))x.forEach((v,i)=>scan(v,path+'['+i+']',depth+1));else if(x&&typeof x==='object')for(const [k,v]of Object.entries(x))scan(v,path+'.'+k,depth+1);};
 const leaf=(v:unknown,path:string)=>{const constants:Record<string,unknown>={store:false,max_output_tokens:1400,'text.format.type':'json_schema','text.format.name':'saha_evidence_v1','text.format.strict':true,contract:'saha-agent-v1','limits.maxOutputTokens':1400,'limits.maxCalls':1};if(path in constants){if(v!==constants[path])problems.push(path+' differs from the fixed envelope contract.');}else if(typeof v!=='string'||v.length>12000)problems.push(path+' requires a bounded string.');if((path==='task')&&!['extract','summary'].includes(String(v)))problems.push('Unsupported provider task.');if(path==='input'){try{const x=JSON.parse(String(v));if(!x||Object.keys(x).sort().join(',')!=='source,task'||!['extract','summary'].includes(x.task)||typeof x.source!=='string')problems.push('input differs from the source/task contract.');else scan(x.source,'input.source');}catch{problems.push('input differs from the source/task contract.');}}scan(v,path);};
 const walk=(x:unknown,path:string):unknown=>{if(!x||typeof x!=='object'||Array.isArray(x)){problems.push(path+' requires an envelope object.');return x;}const out:Record<string,unknown>={},allowed=PATH_KEYS[mode][path];if(!allowed){problems.push(path+' has an unsupported envelope shape.');return out;}for(const[k,v]of Object.entries(x)){fields++;const next=path?path+'.'+k:k;if(!allowed.has(k)){stripped.push(next);continue;}const isStatic=next==='instructions'||next==='outputSchema'||next==='text.format.schema';if(isStatic){if(trustedStatic){const expected=next==='instructions'?trustedStatic.instructions:trustedStatic.schema;if(JSON.stringify(v)!==JSON.stringify(expected))problems.push(next+' differs from the fixed provider contract.');}else scan(v,next);out[k]=v;}else out[k]=PATH_KEYS[mode][next]?walk(v,next):(leaf(v,next),v);}if(trustedStatic)for(const required of allowed)if(!(required in out))problems.push((path?path+'.':'')+required+' is missing.');return out;};
 const reduced=walk(payload,''),check:MinimisationCheck={at,stage,passed:problems.length===0,fields,stripped,problems:[...new Set(problems)].slice(0,20)};if(!check.passed)fail(409,'The AI provider payload failed the payload minimisation check. Nothing was sent.');return{payload:reduced,check};
}
// Legacy assistance builds a fresh request, not an approved stored destination document. Identity/provenance extras are unnecessary here.
export function minimiseLegacyAiPayload(payload:any,sensitive:Set<string>){if(payload?.schemaVersion!=='1.0'||payload?.environment!=='synthetic'||payload?.purpose!=='non-diagnostic visit assistance'||!payload.facts||Array.isArray(payload.facts))fail(409,'Legacy AI envelope requires review. Nothing was sent.');const facts:Record<string,string>={};for(const k of ['date','systolic','diastolic','weight','temperature','weeks','coughDays','notes','source']){const value=payload.facts[k];if(typeof value!=='string')fail(409,'Legacy AI mapped facts require review. Nothing was sent.');facts[k]=value;}const notes=sensitiveText(facts.notes);if(Object.values(facts).some(value=>carriesSensitive(value,sensitive))||/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(notes)||(notes.match(/\+?\d[\d ()-]{8,}\d/g)??[]).some(x=>x.replace(/\D/g,'').length>=10))fail(409,'Legacy AI facts contain sensitive data. Review the note; nothing was sent.');return{schemaVersion:'1.0',environment:'synthetic',purpose:'non-diagnostic visit assistance',facts};}
