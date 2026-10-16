import { identity, loadFor, json } from './server';
import { fail } from './core';
import { scope } from './store';
import { adoptedVersion, catalogueOf, enrollableAt, latestVersion, packIds, packName } from './programmes';
import { mayMigrate, migratablePacks, planProgrammeMigration } from './programme-migration';
// Slice 4e: the programme-pack catalogue with each pack's adopted and latest versions, a dry run for every pack with
// open episodes or adoption on an older version (within the reader's care scope), and the batch history. Owners and
// clinicians only. Ids, versions, counts and reasons; never names or episode labels.
export async function programmeMigrationRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 if(!mayMigrate(m))fail(403,'Only an organisation owner or a clinician can migrate programme episodes.');
 // Slice 4f: installed versions appear here once activated; retired installed versions are listed as retired.
 const catalogue=packIds(s).map(id=>({packId:id,name:packName(id,s),versions:catalogueOf(s).filter(p=>p.id===id&&enrollableAt(id,p.version,s)).map(p=>p.version),retiredVersions:catalogueOf(s).filter(p=>p.id===id&&!enrollableAt(id,p.version,s)).map(p=>p.version),installedVersions:catalogueOf(s).filter(p=>p.id===id&&p.installed).map(p=>p.version),adoptedVersion:adoptedVersion(s,id),latestVersion:latestVersion(id,s)}));
 const plans=[];for(const id of migratablePacks(s))plans.push(await planProgrammeMigration(s,m,id));
 // Slice 6w (fifth review, finding 5): only an owner sees organisation-wide counts and every batch. A clinician
 // sees counts within their care scope (no out-of-scope count) and only the batches they applied, without the
 // organisation-wide examined and out-of-scope counts.
 const shown=m.isOwner?plans:plans.map(p=>({...p,examined:p.candidates.length+p.blocked.length,outOfScope:null,changeControl:{...p.changeControl,affectedPopulation:{...p.changeControl.affectedPopulation,outOfScope:null}},scopeOnly:true}));
 const batches=(s.operations?.programmeMigrations??[]).filter(b=>m.isOwner||b.by===u.userId).map(b=>m.isOwner?b:{...b,examined:null,outOfScope:null,scopeOnly:true});
 return json({catalogue,plans:shown,batches,canAdopt:m.isOwner,scopeOnly:!m.isOwner,generatedAt:new Date().toISOString()});
}
