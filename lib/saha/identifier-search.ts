import { z } from 'zod';
import { fail } from './core';
import { allowed } from './access';
import { KNOWN_ISSUERS, VALUE } from './record-import';
import { currentIdentifiers } from './types';
import type { Member, Person } from './types';

// Slice 10e: search people by an issuer identifier (BR-ID-05) and check the format of an ABHA number (BR-INT-14).
//
// ABHA number format. Saha checks the format only: 14 digits, written without separators or grouped 2-4-4-4 with hyphens
// (for example 91-1234-5678-9012), stored and shown in the grouped form. No checksum is applied. The Ministry of Health and
// Family Welfare explainer on ABHA (Press Information Bureau, 4 April 2024) describes the number as "a random 14-digit
// number" and the CoronaSafe ABDM implementers' guide as "a randomly generated 14 digit number"; no official ABDM or National
// Health Authority document found for this slice specifies a check digit or checksum, and one is not invented here. A number
// that passes the format check is not thereby known to exist in ABDM: the ABHA verification flow (slice 7a) is the only
// route to a linked number.
export const ABHA_FORMAT=/^(\d{14}|\d{2}-\d{4}-\d{4}-\d{4})$/;
export const ABHA_MESSAGE='Enter the 14-digit ABHA number, as 14 digits or grouped 2-4-4-4 with hyphens (for example 91-1234-5678-9012).';
export function parseAbha(text:string):{ok:true;number:string}|{ok:false;reason:string}{
 const t=text.trim();if(!ABHA_FORMAT.test(t))return {ok:false,reason:ABHA_MESSAGE};
 const d=t.replace(/-/g,'');return {ok:true,number:`${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6,10)}-${d.slice(10)}`};
}
// Searchable issuers: ABHA, and the programme issuers that slice 2h imports and slice 10e links.
export const SEARCH_ISSUERS=['abha',...Object.keys(KNOWN_ISSUERS)];
export const ISSUER_LABEL:Record<string,string>={abha:'ABHA number',...Object.fromEntries(Object.entries(KNOWN_ISSUERS).map(([k,v])=>[k,v.label]))};
export const searchInput=z.object({issuer:z.string().trim().toLowerCase().min(1).max(32),identifier:z.string().trim().min(1).max(64)}).strict();
// Exact, complete identifiers only: a value must pass the issuer's whole-value format, so a fragment, a prefix, a wildcard or a
// range is refused with a format message and never searched. Matching is by equality on the whole value.
export function checkSearch(issuer:string,identifier:string):{issuer:string;value:string}{
 if(!SEARCH_ISSUERS.includes(issuer))fail(422,`Search by one of: ${SEARCH_ISSUERS.join(', ')}.`);
 if(issuer==='abha'){const r=parseAbha(identifier);if(!r.ok)fail(422,`${r.reason} A partial number is not searched.`);return {issuer,value:r.number};}
 if(!VALUE.test(identifier)||!KNOWN_ISSUERS[issuer].pattern.test(identifier))fail(422,`${KNOWN_ISSUERS[issuer].format} A partial identifier is not searched.`);
 return {issuer,value:identifier};
}
// Rate limits per searcher, read from the audit chain: every search records one event (a hit one per matched record, sharing a
// search id; a search that finds nothing one without a record). Searches that find nothing are the fishing signal and have
// their own, lower limits.
export const SEARCH_LIMIT_HOUR=30,MISS_LIMIT_HOUR=8,MISS_LIMIT_DAY=24;
export const SEARCH_LIMITED=`Too many identifier searches. At most ${SEARCH_LIMIT_HOUR} searches, ${MISS_LIMIT_HOUR} of them finding nothing, can be made in an hour, and ${MISS_LIMIT_DAY} finding nothing in a day. Try again later; for a wider check ask an identity steward.`;
export const NO_MATCH='No record in your care scope carries this identifier.';
export type SearchUse={hour:number;missHour:number;missDay:number};
export const overLimit=(u:SearchUse)=>u.hour>=SEARCH_LIMIT_HOUR||u.missHour>=MISS_LIMIT_HOUR||u.missDay>=MISS_LIMIT_DAY;
const mask=(v:string)=>v.length>4?'X'.repeat(v.length-4)+v.slice(-4):'X'.repeat(v.length);
export type SearchMatch={personId:string;version:number;name:string;age:number;sex:string;village:string;teamId:string;issuer:string;identifier:string;source:'abha-link'|'import'|'crosswalk';verification:string;verified:boolean;recordedAt:string;merged:{survivorId:string|null}|null};
// Records among `people` that the searcher may see and that hold the identifier now (a corrected or withdrawn value does not
// match; an unlinked ABHA does not match). Records outside the searcher's care scope are never returned or counted.
export function findMatches(people:Person[],m:Member,issuer:string,value:string,now:string):SearchMatch[]{
 const out:SearchMatch[]=[],base=(p:Person)=>({personId:p.id,version:p.version,name:p.name,age:p.age,sex:p.sex,village:p.village,teamId:p.teamId,issuer,identifier:mask(value),merged:p.mergedInto?{survivorId:people.some(x=>x.id===p.mergedInto!.personId&&allowed(m,x,now))?p.mergedInto.personId:null}:null});
 for(const p of people){
  if(!allowed(m,p,now))continue;
  if(issuer==='abha'){if(p.abha?.state==='linked'&&p.abha.number===value)out.push({...base(p),identifier:`${value.slice(0,2)}-XXXX-XXXX-${value.slice(-4)}`,source:'abha-link',verification:'Mock one-time code only; not verified with ABDM',verified:false,recordedAt:p.abha.at});continue;}
  const e=currentIdentifiers(p).find(x=>x.issuer===issuer&&x.value===value);
  if(e)out.push({...base(p),source:e.source==='import'?'import':'crosswalk',verification:e.verification??'unverified',verified:e.verified,recordedAt:e.recordedAt});
 }
 return out.sort((a,b)=>Number(!!a.merged)-Number(!!b.merged));
}
