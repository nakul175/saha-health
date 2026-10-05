import {digest} from './core';
import {expressionLeaves,referenceExpression,type MeasureId} from './indicators';
import {figureMeasure,type FigureMaterial,type FigureUnit} from './indicator-figure-material';
import type {Release} from './indicator-differencing';

export type FigureImpact={version:1;status:'unchanged'|'source-revised'|'counting-affected'|'coverage-unknown';basisHash:string;checkedAt:string;notice:string};
const leaves=(id:string)=>{const e=referenceExpression(id);return e?expressionLeaves(e):[id as MeasureId];};
// Protected profiles never leave this module. All primitive branches matter, even when a composite's final value stays zero.
function profile(u:FigureUnit,r:Release,cutoff:string){
 if(Object.entries(r.f).some(([k,v])=>!u.f[k]?.includes(v))||(r.x??[]).some(x=>u.x.includes(x)))return null;
 const refs=[r.n,r.d].filter((x):x is string=>!!x),primitives=[...new Set(refs.flatMap(leaves))].sort();
 return {groups:[...(u.g[r.gd??'none']??[])].sort(),values:primitives.map(id=>[id,figureMeasure(u,id,r.w??'',r.u??cutoff)])};
}
export async function discoverFigureImpact(original:FigureMaterial,current:FigureMaterial,releases:Release[],cutoff:string,figureDigest:string,definitionsCurrent:boolean,definitionBasis=""):Promise<FigureImpact>{
 const old=new Map(original.units.map(u=>[u.personId,u])),now=new Map(current.units.map(u=>[u.personId,u]));let changed=false,revised=false;
 const supported=original.units.every(u=>u.sourceHashVersion===3)&&current.units.every(u=>u.sourceHashVersion===3)&&definitionsCurrent;
 if(supported)for(const r of releases)for(const personId of new Set([...old.keys(),...now.keys()])){const a=old.get(personId),b=now.get(personId),ap=a?profile(a,r,cutoff):null,bp=b?profile(b,r,cutoff):null;if(JSON.stringify(ap)!==JSON.stringify(bp))changed=true;if((ap||bp)&&a?.sourceHash!==b?.sourceHash)revised=true;}
 const status=!supported?'coverage-unknown':changed?'counting-affected':revised?'source-revised':'unchanged';
 const basisHash=await digest({version:1,figureDigest,status,definitionsCurrent,definitionBasis,current:current.units.map(u=>({personId:u.personId,sourceHashVersion:u.sourceHashVersion??1,sourceHash:u.sourceHash})).sort((a,b)=>a.personId.localeCompare(b.personId))});
 return {version:1,status,basisHash,checkedAt:current.capturedAt,notice:status==='counting-affected'?'Pinned counting inputs changed. Review a new edition; the published original is unchanged.':status==='source-revised'?'Source evidence changed without a changed pinned counting contribution. Review relevance; no replacement is automatic.':status==='coverage-unknown'?'Retained counting coverage or pinned definition authority cannot be safely compared. Independent review is required.':'No change in the pinned counting inputs or their source evidence was discovered.'};
}
