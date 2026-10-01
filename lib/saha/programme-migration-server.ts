import { identity, loadFor, json } from './server';
import { fail } from './core';
import { scope } from './store';
import { PACKS, adoptedVersion, latestVersion } from './programmes';
import { mayMigrate, migratablePacks, planProgrammeMigration } from './programme-migration';
// Slice 4e: the programme-pack catalogue with each pack's adopted and latest versions, a dry run for every pack with
// open episodes or adoption on an older version (within the reader's care scope), and the batch history. Owners and
// clinicians only. Ids, versions, counts and reasons; never names or episode labels.
export async function programmeMigrationRead(request:Request){
 const u=await identity(),s=await loadFor(u,request.headers.get('x-saha-organisation')),m=scope(s,u.userId);
 if(!mayMigrate(m))fail(403,'Only an organisation owner or a clinician can migrate programme episodes.');
 const catalogue=[...new Set(PACKS.map(p=>p.id))].map(id=>({packId:id,name:PACKS.find(p=>p.id===id)!.name,versions:PACKS.filter(p=>p.id===id).map(p=>p.version),adoptedVersion:adoptedVersion(s,id),latestVersion:latestVersion(id)}));
 const plans=[];for(const id of migratablePacks(s))plans.push(await planProgrammeMigration(s,m,id));
 return json({catalogue,plans,batches:s.operations?.programmeMigrations??[],canAdopt:m.isOwner,generatedAt:new Date().toISOString()});
}
