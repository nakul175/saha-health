import {MIN_CELL,WINDOWED} from './indicators';
import {figurePopulation,type FigureMaterial} from './indicator-figure-material';
import {windowOf,type Release} from './indicator-differencing';
// Edition values cannot replace one another in the live seven-day ledger: users can retain original reports.
// This conservative additional guard compares protected patient contributions across actually disclosed editions.
function contributions(material:FigureMaterial,r:Release,measure:string){
 const pop=figurePopulation(material),out=new Map<string,{value:number;groups:string[]}>(),hidden=new Set(r.z??[]),shown=new Set(Object.keys(r.c).filter(g=>!hidden.has(g)));
 material.units.forEach((u,i)=>{if(Object.entries(r.f).some(([k,v])=>!u.f[k]?.includes(v))||(r.x??[]).some(x=>u.x.includes(x)))return;const groups=(u.g[r.gd??'none']??[]).filter(g=>shown.has(g));if(!groups.length)return;out.set(u.personId,{value:pop.units[i].q(measure,windowOf(r,WINDOWED.has(measure as any))),groups:[...groups].sort()});});
 return out;
}
export function editionRisk(oldMaterial:FigureMaterial,old:Release,newMaterial:FigureMaterial,next:Release,min=MIN_CELL){
 const measures=[next.n,...(next.d?[next.d]:[])].filter((x):x is string=>!!x&&[old.n,old.d].includes(x));let worst:number|null=null;
 for(const measure of measures){const a=contributions(oldMaterial,old,measure),b=contributions(newMaterial,next,measure);let changed=0;for(const personId of new Set([...a.keys(),...b.keys()])){const av=a.get(personId),bv=b.get(personId);if(!(av?.value||bv?.value))continue;const valueChanged=(av?.value??0)!==(bv?.value??0),groupChanged=old.gd===next.gd&&JSON.stringify(av?.groups??[])!==JSON.stringify(bv?.groups??[]);if(valueChanged||groupChanged)changed++;}if(changed>0&&changed<min&&(worst===null||changed<worst))worst=changed;}
 return worst;
}
