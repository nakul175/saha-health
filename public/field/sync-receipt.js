// Comparison projection only. Never modifies a saved command, converts units, grants authority or sends it.
// Mirrors the supported fieldSchema/factsSchema JSON output, including fixed nested order and string trimming.
const fields=['systolic','diastolic','weight','temperature','weeks','coughDays'];
const measures=['bloodPressure','weight','temperature','weeks','coughDays'];
const units={weight:'lb',temperature:'degF',coughDays:'wk',systolic:'kPa',diastolic:'kPa',weeks:'wk+d'};
const source=['measured','reported','not-asked','declined','unknown','not-applicable'];
const absence=['Unknown','Not measured','Declined','Unable to obtain'];
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const object=(o,keys)=>{if(!o||Array.isArray(o)||typeof o!=='object'||Object.keys(o).some(k=>!keys.includes(k)))throw Error();return o;};
const string=(x,max,min=0,trim=false)=>{if(typeof x!=='string')throw Error();const s=trim?x.trim():x;if(s.length<min||s.length>max)throw Error();return s;};
const minute=x=>{const s=string(x,16,16);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)||isNaN(Date.parse(s+'Z')))throw Error();return s;};
const choice=(x,items)=>{if(!items.includes(x))throw Error();return x;};
const record=(o,read)=>{object(o,Object.keys(o??{}));if(Object.keys(o).length>500||Object.keys(o).some(k=>['__proto__','constructor','prototype'].includes(k)))throw Error();return Object.fromEntries(Object.entries(o).map(([k,v])=>[k,read(v)]));};
export function parsedSyncCommand(input){try{
 const c=object(input,['type','personId','leaseId','packageHash','offlineWorkHash','facts','answers','absence']);if(c.type!=='syncFieldVisit')return null;
 const out={type:c.type,personId:string(c.personId,200,1),leaseId:string(c.leaseId,200,1),packageHash:string(c.packageHash,64,64)};
 if(own(c,'offlineWorkHash')&&c.offlineWorkHash!==undefined){if(typeof c.offlineWorkHash!=='string'||!/^[0-9a-f]{64}$/.test(c.offlineWorkHash))throw Error();out.offlineWorkHash=c.offlineWorkHash;}
 const f=object(c.facts,['date',...fields,'notes','source','provenance','entered','unusual']),facts={date:minute(f.date)};
 for(const k of fields){const x=string(f[k],12,0,true);if(x!==''&&(!/^[0-9]+(\.[0-9]+)?$/.test(x)||!Number.isFinite(+x)))throw Error();facts[k]=x;}facts.notes=string(f.notes,3000,0,true);facts.source=choice(f.source,['measured','reported']);
 if(f.provenance!==undefined){const p=object(f.provenance,measures),next={};for(const k of measures)if(p[k]!==undefined){const v=object(p[k],['source','at']);next[k]={source:choice(v.source,source)};if(v.at!==undefined)next[k].at=minute(v.at);}facts.provenance=next;}
 if(f.entered!==undefined){const e=object(f.entered,Object.keys(units)),next={};for(const [k,unit] of Object.entries(units))if(e[k]!==undefined){const v=object(e[k],['value','unit']);next[k]={value:string(v.value,12,0,true),unit:choice(v.unit,[unit])};}facts.entered=next;}
 if(f.unusual!==undefined){const u=object(f.unusual,fields),next={};for(const k of fields)if(u[k]!==undefined)next[k]=string(u[k],500,0,true);facts.unusual=next;}
 out.facts=facts;out.answers=record(c.answers,x=>string(x,500));out.absence=record(c.absence,x=>choice(x,absence));return out;
 }catch{return null;}}
